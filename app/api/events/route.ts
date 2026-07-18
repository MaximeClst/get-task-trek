import { authOptions } from "@/lib/AuthOptions";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

// Authentifie puis exige le Premium, en relisant isPremium EN BASE (pas depuis
// la session, qui reste premium apres une resiliation jusqu'a reconnexion).
// Renvoie soit une NextResponse d'erreur (a retourner tel quel), soit l'userId.
async function requirePremiumUser(): Promise<
  { error: NextResponse } | { userId: string }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPremium: true },
  });
  if (!user?.isPremium) {
    return {
      error: NextResponse.json(
        { error: "Réservé aux abonnés Premium" },
        { status: 403 },
      ),
    };
  }

  return { userId: session.user.id };
}

export async function GET(req: Request) {
  const auth = await requirePremiumUser();
  if ("error" in auth) return auth.error;

  try {
    const events = await prisma.event.findMany({
      where: { userId: auth.userId },
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
  const auth = await requirePremiumUser();
  if ("error" in auth) return auth.error;

  // Une route HTTP repond 429 avec Retry-After, plutot que de lever: c'est ce
  // que le client attend, et ca lui dit quand revenir.
  const rate = await checkRateLimit("createEvent", auth.userId);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans un instant." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
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
        userId: auth.userId,
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
