import { authOptions } from "@/lib/AuthOptions";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { createEventSchema, firstError } from "@/lib/validationNotes";
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
    // Un rendez-vous est une note de type EVENT depuis la fusion des modeles.
    const notes = await prisma.note.findMany({
      where: { userId: auth.userId, type: "EVENT" },
    });

    // FullCalendar attend { title, start, end, allDay }: on projette plutot que
    // de lui imposer la forme de notre modele.
    const events = notes.map((note) => ({
      id: note.id,
      title: note.title,
      start: note.startAt,
      end: note.endAt,
      allDay: note.allDay,
    }));

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
    const body = await req.json();

    // Meme schema Zod que le reste: les verifications a la main qui vivaient
    // ici laissaient passer un titre de 5 Mo et rendaient des messages
    // differents pour le meme genre d'erreur.
    const parsed = createEventSchema.safeParse({
      title: body.title,
      content: body.content ?? body.description ?? "",
      startAt: body.startAt ?? body.start,
      endAt: body.endAt ?? body.end,
      allDay: Boolean(body.allDay),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstError(parsed.error) },
        { status: 400 }
      );
    }

    const startDate = new Date(parsed.data.startAt);
    const endDate = new Date(parsed.data.endAt);

    // Gestion des événements en mode toute la journée
    if (parsed.data.allDay) {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    const event = await prisma.note.create({
      data: {
        type: "EVENT",
        title: parsed.data.title,
        content: parsed.data.content,
        startAt: startDate,
        endAt: endDate,
        allDay: parsed.data.allDay,
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
