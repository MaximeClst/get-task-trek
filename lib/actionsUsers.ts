"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "./AuthOptions";
import { prisma } from "./db";

export const getUser = async () => {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      throw new Error("User not authenticated");
    }

    const id = session.user.id as string;
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  } catch (error) {
    console.error("Error retrieving user:", error);
    redirect("/login"); // Redirect to login page if there's an error
  }
};

export const updateUser = async (formData: FormData) => {
  try {
    const userName = formData.get("name") as string;
    const id = formData.get("id") as string;

    if (!userName || !id) {
      throw new Error("Missing required parameters");
    }

    await prisma.user.update({
      where: { id },
      data: { name: userName },
    });

    revalidatePath("/profile");
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
