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

export const deleteUser = async () => {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      throw new Error("User not authenticated");
    }

    const userId = session.user.id as string;

    // Delete related data in a specific order
    await prisma.subscription.deleteMany({
      where: { userId },
    });

    await prisma.session.deleteMany({
      where: { userId },
    });

    await prisma.account.deleteMany({
      where: { userId },
    });

    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath("/");
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
};
