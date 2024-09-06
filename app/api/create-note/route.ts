import { createNote } from "@/lib/actionsNotes";
import { authOptions } from "@/lib/AuthOptions";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { title, description, date } = await req.json();

  if (!title || !description || !date) {
    return NextResponse.json(
      { error: "Paramètres manquants" },
      { status: 400 }
    );
  }

  try {
    // Ici, on utilise 'date' pour le champ 'start' et 'end'
    const start = new Date(date).toISOString();
    const end = new Date(
      new Date(date).getTime() + 60 * 60 * 1000
    ).toISOString(); // Exemple : 1 heure plus tard

    // Appel à la fonction `createNote`
    await createNote({
      title,
      description,
      start,
      end,
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
