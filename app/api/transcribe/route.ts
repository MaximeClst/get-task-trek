import { authOptions } from "@/lib/AuthOptions";
import { prisma } from "@/lib/db";
import openai from "@/lib/openai";
import { ajouterSecondes, lireUsage } from "@/lib/quotaTranscription";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  ACCEPTED_AUDIO_TYPES,
  MAX_AUDIO_BYTES,
  extensionForMimeType,
} from "@/lib/transcription";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";

// Le SDK openai 4.56 type le retour comme { text } quel que soit le
// response_format: TranscriptionVerbose n'existe que dans des versions plus
// recentes. Plutot qu'un cast aveugle, on valide la forme reellement recue.
// Si OpenAI change son format, on le saura par une duree a 0 -- pas par un
// plantage, ni par un quota qui cesse silencieusement de compter.
const reponseWhisperSchema = z.object({
  text: z.string().optional(),
  duration: z.number().nonnegative().optional(),
});

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

  // isPremium est relu EN BASE, jamais depuis la session: apres une
  // resiliation le cookie garderait l'ancienne valeur et donnerait le quota
  // Premium a un compte redevenu gratuit. Regle 2 du CLAUDE.md.
  const utilisateur = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true },
  });

  const usage = await lireUsage(userId, utilisateur?.isPremium ?? false);

  if (usage.restantSecondes <= 0) {
    return NextResponse.json(
      {
        error:
          "Vous avez atteint votre quota de dictée pour ce mois-ci.",
        quota: {
          utiliseSecondes: usage.utiliseSecondes,
          quotaSecondes: usage.quotaSecondes,
          renouvelleLe: usage.renouvelleLe.toISOString(),
        },
      },
      { status: 429 }
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
      // Whisper se sert du prompt comme d'un contexte: il l'oriente vers un
      // registre et un vocabulaire. Donner un exemple de note bien ponctuee
      // ameliore nettement la ponctuation et les mots du domaine (rendez-vous,
      // echeance, rappeler...), qu'il rendait sinon phonetiquement.
      // Ce n'est PAS une instruction: Whisper ne suit pas des consignes, il
      // s'aligne sur le style de ce qu'on lui donne.
      prompt:
        "Note personnelle en français. Exemples : Rappeler le plombier demain matin. " +
        "Rendez-vous chez le dentiste jeudi à 14 h. Acheter du pain et des œufs. " +
        "Échéance du dossier vendredi.",
      // Deterministe: a audio egal, meme transcription. Whisper "invente"
      // davantage quand la temperature monte.
      temperature: 0,
      // verbose_json rend la DUREE reellement traitee. C'est elle qu'OpenAI
      // facture, et donc la seule mesure honnete a decompter du quota -- une
      // duree annoncee par le navigateur serait declarative, donc falsifiable.
      response_format: "verbose_json",
    });

    const parsed = reponseWhisperSchema.safeParse(transcription);
    const duree = parsed.success ? (parsed.data.duration ?? 0) : 0;

    if (!parsed.success || parsed.data.duration === undefined) {
      // Le quota ne compterait plus rien sans qu'on s'en apercoive: on le dit.
      console.error(
        "Durée absente de la réponse Whisper — quota non décompté pour cet appel."
      );
    }

    // La duree est comptabilisee meme si le texte revient vide: l'appel a ete
    // facture, il doit etre decompte.
    await ajouterSecondes(userId, duree);

    const text = transcription.text?.trim() ?? "";

    if (!text) {
      return NextResponse.json(
        { error: "Rien n'a été reconnu dans cet enregistrement." },
        { status: 422 }
      );
    }

    // On renvoie le restant pour que l'ecran l'affiche sans avoir a redemander.
    const apres = Math.max(0, usage.restantSecondes - duree);

    return NextResponse.json({
      text,
      restantSecondes: Math.floor(apres),
    });
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
