"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "./actionsUsers";
import { prisma } from "./db";

export const getAllNotes = async (userId: string) => {
  const data = await prisma.notes.findMany({
    where: {
      userId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return data;
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
  const userId = user?.id as string;

  // Vérifier la limite de 10 notes
  const userNotesCount = await prisma.notes.count({
    where: { userId: userId },
  });

  if (!user?.isPremium && userNotesCount >= 10) {
    throw new Error(
      "Vous avez atteint la limite de 10 notes. Passez à Premium pour en créer plus."
    );
  }

  await prisma.notes.create({
    data: {
      userId: userId,
      title: title,
      description: description,
      start: new Date(start),
      end: new Date(end),
    },
  });
  redirect("/dashboard/notes");
};

export const deleteNote = async (formData: FormData) => {
  const id = formData.get("id") as string;
  await prisma.notes.delete({
    where: { id },
  });
  revalidatePath("/");
};

export const getNote = async (id: string) => {
  const note = await prisma.notes.findUnique({
    where: { id: id },
  });
  return note;
};

export const updateNote = async (formData: FormData) => {
  try {
    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const completed = formData.get("completed");

    if (title !== null || description !== null) {
      await prisma.notes.update({
        where: { id },
        data: {
          title: title,
          description: description,
          completed: completed === "on",
        },
      });
    }
  } catch (error) {
    console.error("Erreur lors de la modification de la note", error);
  } finally {
    redirect("/");
  }
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
  const userId = user?.id as string;

  await prisma.notes.create({
    data: {
      userId: userId,
      title: title,
      description: `${description} - Planifié pour ${time}`,
    },
  });
}
