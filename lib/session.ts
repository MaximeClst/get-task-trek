import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { authOptions } from "./AuthOptions";
import { prisma } from "./db";

// Volontairement hors d'un fichier "use server": getUser n'est appelee que
// depuis le serveur, l'exposer comme Server Action l'ouvrirait au public.
//
// cache() dedoublonne l'appel sur la duree d'une requete. Le layout du
// dashboard et la page qu'il rend appellent tous deux getUser(): sans cela,
// les memes requetes partaient deux fois. Chaque aller-retour compte -- la
// base est a Frankfurt, l'utilisateur a La Reunion.
export const getUser = cache(async () => {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      throw new Error("User not authenticated");
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id as string },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  } catch (error) {
    console.error("Error retrieving user:", error);
    // Ne jamais appeler getUser() depuis /login: cette redirection y bouclerait.
    redirect("/login");
  }
});
