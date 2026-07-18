import { authOptions } from "@/lib/AuthOptions";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  // Vérification de l'authentification
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = params;

  // Validation de l'ID (si applicable)
  if (!id) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  }

  try {
    // deleteMany porte le userId DANS le WHERE, en une seule requete.
    // L'ancienne version lisait avec findFirst({id, userId}) puis supprimait
    // avec delete({id}) -- la suppression, elle, n'etait plus portee par le
    // proprietaire. C'est le motif que la regle 1 du CLAUDE.md interdit.
    // Au passage: un aller-retour au lieu de deux.
    const { count } = await prisma.note.deleteMany({
      where: { id, userId: session.user.id, type: "EVENT" },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "Événement introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Événement supprimé avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'événement :", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'événement." },
      { status: 500 }
    );
  }
}
