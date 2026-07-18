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

// Une Server Action est un endpoint HTTP public: n'importe qui peut l'appeler
// avec les arguments de son choix. Aucun identifiant venant du client n'est
// digne de confiance. Chaque action relit donc l'utilisateur via getUser() et
// porte son userId dans le WHERE de la requete -- jamais dans un test apres
// coup, qui laisserait une fenetre entre la lecture et la verification.

export const getAllNotes = async () => {
  const user = await getUser();

  return prisma.notes.findMany({
    where: { userId: user.id },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const createNote = async ({
  title,
  description,
  start,
  end,
}: {
  title: string;
  description: string;
  start: string;
  end: string;
}) => {
  const user = await getUser();

  // Valider AVANT de compter: inutile de payer un aller-retour vers Frankfurt
  // pour une saisie qu'on va refuser.
  const parsed = createNoteSchema.safeParse({ title, description, start, end });
  if (!parsed.success) {
    throw new Error(firstError(parsed.error));
  }

  await enforceRateLimit("createNote", user.id);

  // Vérifier la limite de 10 notes
  const userNotesCount = await prisma.notes.count({
    where: { userId: user.id },
  });

  if (!user.isPremium && userNotesCount >= 10) {
    throw new Error(
      "Vous avez atteint la limite de 10 notes. Passez à Premium pour en créer plus.",
    );
  }

  await prisma.notes.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      start: new Date(parsed.data.start),
      end: new Date(parsed.data.end),
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
  const { count } = await prisma.notes.deleteMany({
    where: { id, userId: user.id },
  });

  // Meme message si la note n'existe pas et si elle appartient a un autre:
  // distinguer les deux revelerait quelles notes existent.
  if (count === 0) {
    throw new Error("Note introuvable.");
  }

  revalidatePath("/dashboard/notes");
};

export const getNote = async (id: string) => {
  const user = await getUser();

  return prisma.notes.findFirst({
    where: { id, userId: user.id },
  });
};

export const updateNote = async (formData: FormData) => {
  const user = await getUser();

  const parsed = updateNoteSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description"),
    completed: formData.get("completed") === "on",
  });

  if (!parsed.success) {
    throw new Error(firstError(parsed.error));
  }

  const { id, title, description, completed } = parsed.data;

  const { count } = await prisma.notes.updateMany({
    where: { id, userId: user.id },
    data: {
      title: title,
      description: description,
      completed: completed,
    },
  });

  if (count === 0) {
    throw new Error("Note introuvable.");
  }

  revalidatePath("/dashboard/notes");

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
