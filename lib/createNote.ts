import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "./db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ error: "You must be logged in." });
  }

  const email = session.user?.email;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const user = await prisma.user.findUnique({
    where: { email: email },
    select: {
      id: true,
      isPremium: true,
      notesCount: true,
      _count: {
        select: {
          notes: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Vérifier si l'user est Premium ou si il a atteint 100 notes
  if (!user.isPremium && user._count.notes >= 100) {
    return res.status(403).json({
      error:
        "You can't write this note, to write more you have to go to Premium.",
    });
  }

  // Créer la note si la limite n'est pas atteinte
  const { description } = req.body;

  if (!description) {
    return res.status(400).json({ error: "Description is required" });
  }

  const note = await prisma.notes.create({
    data: {
      description: description,
      userId: user.id,
    },
  });

  // Mettre à jour le nombre de notes de l'utilisateur
  await prisma.user.update({
    where: { id: user.id },
    data: { notesCount: { increment: 1 } },
  });

  res.status(201).json(note);
}
