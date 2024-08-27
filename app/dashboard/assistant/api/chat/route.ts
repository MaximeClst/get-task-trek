import { authOptions } from "@/lib/AuthOptions";
import openai from "@/lib/openai";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!session.user.isPremium) {
    return NextResponse.json(
      { error: "Accès réservé aux membres Premium" },
      { status: 403 }
    );
  }

  const { message } = await req.json();

  if (!message) {
    return NextResponse.json({ error: "Message requis" }, { status: 400 });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: message }],
    });

    const response = completion.choices[0].message?.content;

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Erreur avec l'API OpenAI :", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération de la réponse de l'assistant." },
      { status: 500 }
    );
  }
}
