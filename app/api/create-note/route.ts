import { createNote } from "@/lib/actionsNotes";
import { authOptions } from "@/lib/AuthOptions";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  // Vérification de la session
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { title, content, description, date, type } = await req.json();

  // Vérification des paramètres requis. Le contenu et la date sont desormais
  // facultatifs: une note simple n'a ni echeance ni corps obligatoire. La
  // validation de fond (longueurs, dates reelles) vit dans createNote.
  if (!title) {
    return NextResponse.json({ error: "Titre manquant" }, { status: 400 });
  }

  try {
    // Une date fournie donne un creneau d'une heure, comme avant.
    const startAt = date ? new Date(date).toISOString() : undefined;
    const endAt = date
      ? new Date(new Date(date).getTime() + 60 * 60 * 1000).toISOString()
      : undefined;

    // Création de la note
    await createNote({
      type,
      title,
      // `description` reste accepte pour ne pas casser un appelant existant.
      content: content ?? description ?? "",
      startAt,
      endAt,
    });

    return NextResponse.json({ message: "Note créée avec succès" });
  } catch (error) {
    console.error("Erreur lors de la création de la note", error);
    return NextResponse.json({
      error: "Erreur lors de la création de la note",
      status: 500,
    });
  }
}
