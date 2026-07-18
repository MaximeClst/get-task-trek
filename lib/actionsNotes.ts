"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "./session";
import { prisma } from "./db";
import {
  createNoteSchema,
  updateNoteSchema,
  firstError,
} from "./validationNotes";
import { enforceRateLimit } from "./rateLimit";
import type { NoteType } from "@prisma/client";

// Une Server Action est un endpoint HTTP public: n'importe qui peut l'appeler
// avec les arguments de son choix. Aucun identifiant venant du client n'est
// digne de confiance. Chaque action relit donc l'utilisateur via getUser() et
// porte son userId dans le WHERE de la requete -- jamais dans un test apres
// coup, qui laisserait une fenetre entre la lecture et la verification.

// Un categoryId arrive du navigateur: rien ne garantit qu'il designe une
// categorie de CET utilisateur. Sans cette verification, n'importe qui pourrait
// rattacher ses notes aux categories d'un autre compte -- la contrainte de cle
// etrangere, elle, ne verifie que l'existence, pas le proprietaire.
//
// Le cout est d'un aller-retour, et seulement quand une categorie est choisie.
async function resolveCategoryId(
  categoryId: string | undefined,
  userId: string,
): Promise<string | null> {
  if (!categoryId) return null;

  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  // Meme message que pour une categorie inexistante: distinguer les deux
  // revelerait quelles categories existent chez les autres.
  if (!category) {
    throw new Error("Categorie introuvable.");
  }

  return category.id;
}

// Notes et Event ont fusionne: un rendez-vous est une note de type EVENT. Le
// filtre par type est donc optionnel -- sans lui, on rend tout, ce que faisait
// deja l'ancien getAllNotes.
export const getAllNotes = async (type?: NoteType) => {
  const user = await getUser();

  return prisma.note.findMany({
    where: { userId: user.id, ...(type ? { type } : {}) },
    include: { category: true },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const createNote = async ({
  type,
  title,
  content,
  startAt,
  endAt,
  categoryId,
}: {
  type?: NoteType;
  title: string;
  content: string;
  startAt?: string;
  endAt?: string;
  categoryId?: string;
}) => {
  const user = await getUser();

  // Valider AVANT de compter: inutile de payer un aller-retour vers Frankfurt
  // pour une saisie qu'on va refuser.
  const parsed = createNoteSchema.safeParse({
    type,
    title,
    content,
    startAt,
    endAt,
    categoryId,
  });
  if (!parsed.success) {
    throw new Error(firstError(parsed.error));
  }

  await enforceRateLimit("createNote", user.id);

  // Vérifier la limite de 10 notes
  const userNotesCount = await prisma.note.count({
    where: { userId: user.id },
  });

  if (!user.isPremium && userNotesCount >= 10) {
    throw new Error(
      "Vous avez atteint la limite de 10 notes. Passez à Premium pour en créer plus.",
    );
  }

  const safeCategoryId = await resolveCategoryId(
    parsed.data.categoryId,
    user.id,
  );

  await prisma.note.create({
    data: {
      userId: user.id,
      type: parsed.data.type,
      title: parsed.data.title,
      content: parsed.data.content,
      startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : null,
      endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
      categoryId: safeCategoryId,
    },
  });

  // Pas de redirect() ici: cette action est aussi appelee par
  // /api/create-note, ou NEXT_REDIRECT serait capture par le try/catch de la
  // route et renverrait un 500 alors que la note a bien ete creee.
  revalidatePath("/dashboard/notes");
};

export const deleteNote = async (formData: FormData) => {
  const user = await getUser();
  const id = formData.get("id") as string;

  // deleteMany porte le userId dans le WHERE: la note d'un autre ne
  // correspond a rien et reste intacte.
  const { count } = await prisma.note.deleteMany({
    where: { id, userId: user.id },
  });

  // Meme message si la note n'existe pas et si elle appartient a un autre:
  // distinguer les deux revelerait quelles notes existent.
  if (count === 0) {
    throw new Error("Note introuvable.");
  }

  revalidatePath("/dashboard/notes");
  revalidatePath("/dashboard/calendar");
};

export const getNote = async (id: string) => {
  const user = await getUser();

  return prisma.note.findFirst({
    where: { id, userId: user.id },
    include: { category: true },
  });
};

export const updateNote = async (formData: FormData) => {
  const user = await getUser();

  const parsed = updateNoteSchema.safeParse({
    id: formData.get("id"),
    type: formData.get("type"),
    title: formData.get("title"),
    content: formData.get("content"),
    completed: formData.get("completed") === "on",
    categoryId: formData.get("categoryId"),
  });

  if (!parsed.success) {
    throw new Error(firstError(parsed.error));
  }

  const { id, type, title, content, completed } = parsed.data;
  const safeCategoryId = await resolveCategoryId(
    parsed.data.categoryId,
    user.id,
  );

  const { count } = await prisma.note.updateMany({
    where: { id, userId: user.id },
    data: {
      type,
      title,
      content,
      completed,
      categoryId: safeCategoryId,
    },
  });

  if (count === 0) {
    throw new Error("Note introuvable.");
  }

  revalidatePath("/dashboard/notes");
  revalidatePath("/dashboard/calendar");

  // redirect() leve NEXT_REDIRECT: le laisser hors de tout try/catch/finally.
  redirect("/dashboard/notes");
};

// addNoteToCalendar a ete supprimee ici. Elle creait une note SANS verifier le
// quota de 10, et n'etait appelee par aucun code -- mais exportee depuis un
// fichier "use server", donc joignable en HTTP par n'importe qui. C'etait un
// contournement complet du plafond gratuit, accessible en une requete.
//
// Si un jour l'assistant a besoin de creer une note, il passe par createNote(),
// qui compte. Ne pas reintroduire de chemin d'ecriture parallele.
