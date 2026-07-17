"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "./actionsUsers";
import { prisma } from "./db";

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
      title: title,
      description: description,
      start: new Date(start),
      end: new Date(end),
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

  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const completed = formData.get("completed");

  const { count } = await prisma.notes.updateMany({
    where: { id, userId: user.id },
    data: {
      title: title,
      description: description,
      completed: completed === "on",
    },
  });

  if (count === 0) {
    throw new Error("Note introuvable.");
  }

  revalidatePath("/dashboard/notes");

  // redirect() leve NEXT_REDIRECT: le laisser hors de tout try/catch/finally.
  redirect("/dashboard/notes");
};

export async function addNoteToCalendar({
  title,
  description,
  time,
}: {
  title: string;
  description: string;
  time: string;
}) {
  const user = await getUser();

  await prisma.notes.create({
    data: {
      userId: user.id,
      title: title,
      description: `${description} - Planifié pour ${time}`,
    },
  });

  revalidatePath("/dashboard/notes");
}
