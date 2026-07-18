import { authOptions } from "@/lib/AuthOptions";
import openai from "@/lib/openai";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  ACCEPTED_AUDIO_TYPES,
  MAX_AUDIO_BYTES,
  extensionForMimeType,
} from "@/lib/transcription";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

// La transcription est ouverte a TOUS, Free inclus: c'est le seul appel IA du
// tier gratuit (voir CLAUDE.md). Le Premium n'automatise pas la dictee, il
// automatise le TRI qui vient apres.
//
// Pas de getUser() ici: il appelle redirect(), qui leve NEXT_REDIRECT. Attrape
// par le try/catch d'une route, ca produirait un 500 alors que tout va bien.
// C'est la regle 3 du CLAUDE.md, et un bug reel de la v1.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const userId = session.user.id;

  // Avant tout travail: chaque appel qui passe ici coute de l'argent reel.
  const rate = await checkRateLimit("transcribe", userId);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error:
          "Vous avez atteint la limite de dictées pour cette heure. Réessayez plus tard.",
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    const audio = formData.get("audio");
    if (audio instanceof File) {
      file = audio;
    }
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "Aucun audio reçu" }, { status: 400 });
  }

  // La limite de duree cote client n'est PAS une limite: cette route est
  // publique, on peut lui poster n'importe quoi. Le poids est ce qu'on peut
  // verifier ici a coup sur, avant d'envoyer quoi que ce soit a OpenAI.
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Enregistrement trop volumineux." },
      { status: 413 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { error: "Enregistrement vide." },
      { status: 400 }
    );
  }

  const mimeType = file.type.split(";")[0].trim();
  const accepte = ACCEPTED_AUDIO_TYPES.some((type) => type === mimeType);
  if (!accepte) {
    return NextResponse.json(
      { error: "Format audio non pris en charge." },
      { status: 415 }
    );
  }

  try {
    // Whisper reconnait le format a l'extension: on renomme le fichier plutot
    // que de compter sur le type MIME, que l'API ignore.
    const nomme = new File(
      [await file.arrayBuffer()],
      `dictee.${extensionForMimeType(mimeType)}`,
      { type: mimeType }
    );

    const transcription = await openai.audio.transcriptions.create({
      file: nomme,
      model: "whisper-1",
      language: "fr",
    });

    const text = transcription.text?.trim() ?? "";

    if (!text) {
      return NextResponse.json(
        { error: "Rien n'a été reconnu dans cet enregistrement." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    // On ne renvoie jamais le message d'OpenAI tel quel: il peut contenir des
    // details d'infrastructure, voire un fragment de cle selon l'erreur.
    console.error("Erreur de transcription :", error);
    return NextResponse.json(
      { error: "La transcription a échoué. Réessayez." },
      { status: 502 }
    );
  }
}
