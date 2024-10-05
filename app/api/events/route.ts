import { authOptions } from "@/lib/AuthOptions";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  // Vérification de l'authentification
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const events = await prisma.event.findMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Erreur lors de la récupération des événements :", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des événements." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  // Vérification de l'authentification
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { title, description, start, end, allDay } = await req.json();

    // Validation des données
    if (!title || !start || !end) {
      return NextResponse.json(
        { error: "Paramètres manquants" },
        { status: 400 }
      );
    }

    // Vérification du format des dates
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Format de date invalide" },
        { status: 400 }
      );
    }

    // Gestion des événements en mode toute la journée
    if (allDay) {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        start: startDate,
        end: endDate,
        allDay: allDay || false,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Erreur lors de la création de l'événement :", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'événement." },
      { status: 500 }
    );
  }
}
