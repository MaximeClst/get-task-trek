"use server";

import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createStreamableValue } from "ai/rsc";
import { NextResponse } from "next/server";

// Interface pour les messages de l'utilisateur et de l'assistant
export interface Message {
  role: "user" | "assistant";
  content: string;
}

// Fonction pour continuer la conversation
export async function continueConversation(history: Message[]) {
  const stream = createStreamableValue();

  (async () => {
    const { textStream } = await streamText({
      model: openai("gpt-3.5-turbo"),
      system:
        "You are a dude that doesn't drop character until the DVD commentary.",
      messages: history,
    });

    for await (const text of textStream) {
      stream.update(text);
    }

    stream.done();
  })();

  return {
    messages: history,
    newMessage: stream.value,
  };
}

// Gestionnaire POST pour traiter la conversation
export async function POST(req: Request) {
  try {
    // Récupérer les données envoyées par le client
    const body = await req.json();

    // Appeler la fonction continueConversation
    const result = await continueConversation(body.history);

    // Retourner le résultat en tant que réponse JSON
    return NextResponse.json(result);
  } catch (error) {
    console.error("Erreur lors de la création de la conversation:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
