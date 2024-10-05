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
    const event = await prisma.event.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    // Vérification de l'existence de l'événement
    if (!event) {
      return NextResponse.json(
        { error: "Événement introuvable" },
        { status: 404 }
      );
    }

    // Suppression de l'événement
    await prisma.event.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ message: "Événement supprimé avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'événement :", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'événement." },
      { status: 500 }
    );
  }
}
