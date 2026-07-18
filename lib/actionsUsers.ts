"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "./AuthOptions";
import { prisma } from "./db";
import { getUser } from "./session";

// getUser vit dans lib/session.ts: ce fichier est "use server", donc tout ce
// qu'il exporte devient un endpoint HTTP public.

export const updateUser = async (formData: FormData) => {
  try {
    // L'utilisateur vient de la session, jamais du formulaire: un champ cache
    // est modifiable depuis le navigateur, et permettait ici de renommer
    // n'importe quel compte.
    const user = await getUser();
    const userName = formData.get("name") as string;

    if (!userName) {
      throw new Error("Missing required parameters");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { name: userName },
    });

    revalidatePath("/dashboard/settings");
  } catch (error) {
    console.error("Error updating user:", error);
    throw error; // Ensure error is propagated
  }
};

// Une seule suppression: toutes les relations vers User portent desormais
// onDelete: Cascade, Postgres se charge du reste.
//
// Cette action enumerait auparavant les tables a vider a la main -- et en
// oubliait deux, Notes et Event. Resultat: tout utilisateur ayant au moins une
// note se prenait un P2003 et ne pouvait PAS supprimer son compte. C'est un
// enjeu RGPD, pas un confort.
//
// La liste manuelle etait le bug: elle demandait qu'on pense a la mettre a jour
// a chaque nouveau modele. La cascade, elle, est declaree a cote de la relation
// et ne peut pas etre oubliee.
export const deleteUser = async () => {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      throw new Error("User not authenticated");
    }

    await prisma.user.delete({
      where: { id: session.user.id as string },
    });

    revalidatePath("/");
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
};
