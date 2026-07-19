"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getUser } from "./session";
import { enforceRateLimit } from "./rateLimit";
import {
  createCategorySchema,
  updateCategorySchema,
  CATEGORY_MAX_PER_USER,
} from "./validationCategories";
import { firstError } from "./validationNotes";

// Meme regle que pour les notes: une Server Action est un endpoint HTTP public.
// L'utilisateur est resolu ici, jamais recu en argument, et son userId va dans
// le WHERE de chaque requete.

export const getAllCategories = async () => {
  const user = await getUser();

  return prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    // Le compteur sert a prevenir avant une suppression: "3 notes perdront
    // leur categorie" est une information que l'utilisateur merite d'avoir.
    include: { _count: { select: { notes: true } } },
  });
};

export const createCategory = async (formData: FormData) => {
  const user = await getUser();

  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error(firstError(parsed.error));
  }

  await enforceRateLimit("createCategory", user.id);

  const count = await prisma.category.count({ where: { userId: user.id } });
  if (count >= CATEGORY_MAX_PER_USER) {
    throw new Error(
      `Vous avez atteint la limite de ${CATEGORY_MAX_PER_USER} categories.`
    );
  }

  // L'identifiant est RENVOYE: quand Treky propose une nouvelle categorie,
  // l'ecran doit pouvoir la creer puis y rattacher la note dans la foulee. Sans
  // ca il faudrait relire la liste entiere pour retrouver ce qu'on vient
  // d'ecrire -- un aller-retour vers Frankfurt pour une valeur qu'on avait.
  // Les autres appelants ignorent simplement ce retour.
  let cree: { id: string };

  try {
    cree = await prisma.category.create({
      data: {
        name: parsed.data.name,
        color: parsed.data.color,
        userId: user.id,
      },
      select: { id: true },
    });
  } catch (error) {
    // @@unique([userId, name]) protege des doublons. On traduit le code Prisma
    // plutot que de laisser fuiter une erreur de contrainte a l'ecran.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Vous avez deja une categorie portant ce nom.");
    }
    throw error;
  }

  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/notes");

  return cree.id;
};

export const updateCategory = async (formData: FormData) => {
  const user = await getUser();

  const parsed = updateCategorySchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    color: formData.get("color") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error(firstError(parsed.error));
  }

  try {
    // updateMany et non update: le userId vit dans le WHERE, donc la categorie
    // d'un autre ne correspond a rien au lieu d'etre modifiee.
    const { count } = await prisma.category.updateMany({
      where: { id: parsed.data.id, userId: user.id },
      data: { name: parsed.data.name, color: parsed.data.color },
    });

    if (count === 0) {
      throw new Error("Categorie introuvable.");
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Vous avez deja une categorie portant ce nom.");
    }
    throw error;
  }

  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/notes");
};

export const deleteCategory = async (formData: FormData) => {
  const user = await getUser();
  const id = formData.get("id") as string;

  // Les notes ne sont PAS supprimees: la relation est en onDelete SetNull,
  // elles repassent simplement en "sans categorie".
  const { count } = await prisma.category.deleteMany({
    where: { id, userId: user.id },
  });

  if (count === 0) {
    throw new Error("Categorie introuvable.");
  }

  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/notes");
};
