import { authOptions } from "@/lib/AuthOptions";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const { id } = params;

    const event = await prisma.event.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Evènement introuvable" },
        { status: 404 }
      );
    }
    await prisma.event.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ message: "Evènement supprimé avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'événement :", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'événement." },
      { status: 500 }
    );
  }
}
