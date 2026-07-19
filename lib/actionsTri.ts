"use server";

import { prisma } from "./db";
import openai from "./openai";
import { enforceRateLimit } from "./rateLimit";
import { getUser } from "./session";
import {
  TRI_JSON_SCHEMA,
  TRI_MODEL,
  construireInstructions,
  decalageSchema,
  resoudreCategorie,
  sortieTriSchema,
  versUtc,
} from "./validationTri";
import { CONTENT_MAX } from "./validationNotes";
import type { NoteType } from "@prisma/client";

// Le tri Premium: une seule passe qui classe (note / tache / rendez-vous) et
// categorise. C'est la SEULE difference de traitement entre les deux offres --
// la dictee et la transcription sont ouvertes a tous.
//
// Cette action ne PROPOSE qu'un remplissage: elle n'ecrit rien en base.
// L'utilisateur relit, corrige, puis valide via createNote, qui reste le seul
// chemin d'ecriture (et le seul qui compte le quota de 10 notes).
//
// Pas de requirePremium() ici: il appelle redirect(), qui leve NEXT_REDIRECT.
// Le composant appelant enveloppe cette action dans un try/catch pour afficher
// un toast, et y attraperait la redirection. Une action signale par une erreur.

export const trierTranscript = async ({
  transcript,
  decalageMinutes,
}: {
  transcript: string;
  decalageMinutes?: number;
}): Promise<{
  type: NoteType;
  title: string;
  content: string;
  categoryId: string | null;
  newCategoryName: string | null;
  startAt: string | null;
}> => {
  const user = await getUser();

  // isPremium vient de getUser(), donc de la BASE -- pas de la session. Apres
  // une resiliation, le cookie garderait l'ancienne valeur et offrirait le tri
  // a un compte redevenu gratuit. Regle 2 du CLAUDE.md.
  if (!user.isPremium) {
    throw new Error("Le tri automatique est reserve a l'offre Premium.");
  }

  const texte = transcript.trim();
  if (!texte) {
    throw new Error("Rien a trier.");
  }

  // Le transcript vient du navigateur: cette action est un endpoint public, on
  // peut lui poster autre chose que la sortie de Whisper. La borne est la meme
  // que celle d'une note, puisque c'est ce qu'il va devenir.
  if (texte.length > CONTENT_MAX) {
    throw new Error("Transcription trop longue.");
  }

  await enforceRateLimit("trier", user.id);

  const decalage = decalageSchema.parse(decalageMinutes ?? 0);

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Heure locale de l'utilisateur, reconstruite depuis son decalage: le serveur
  // est en UTC, et "jeudi 14 h" ne veut rien dire sans savoir quel jour il est
  // chez celui qui parle.
  const local = new Date(Date.now() - decalage * 60_000);
  const maintenantLocal = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(local);

  let brut: string;
  try {
    const reponse = await openai.chat.completions.create({
      model: TRI_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: construireInstructions(maintenantLocal, categories),
        },
        { role: "user", content: texte },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tri_note",
          strict: true,
          schema: TRI_JSON_SCHEMA,
        },
      },
    });

    brut = reponse.choices[0]?.message?.content ?? "";
  } catch (error) {
    // Jamais le message d'OpenAI tel quel: il peut porter des details
    // d'infrastructure, voire un fragment de cle selon l'erreur.
    console.error("Erreur de tri :", error);
    throw new Error("Le tri a échoué. Classez la note vous-même.");
  }

  let json: unknown;
  try {
    json = JSON.parse(brut);
  } catch {
    console.error("Sortie de tri illisible :", brut.slice(0, 500));
    throw new Error("Le tri a échoué. Classez la note vous-même.");
  }

  const parsed = sortieTriSchema.safeParse(json);
  if (!parsed.success) {
    console.error("Sortie de tri invalide :", parsed.error.issues);
    throw new Error("Le tri a échoué. Classez la note vous-même.");
  }

  // LE point de cette PR: la sortie du modele ne designe une categorie que si
  // cette categorie appartient bien a l'utilisateur (voir resoudreCategorie).
  const { categoryId, newCategoryName } = resoudreCategorie(
    parsed.data,
    new Set(categories.map((c) => c.id)),
  );

  if (parsed.data.categoryId && !categoryId) {
    console.error("Le modele a propose un categoryId inconnu, ignore.");
  }

  // Une date n'a de sens que sur un rendez-vous ou une tache a echeance.
  const startAt =
    parsed.data.startAt && parsed.data.type !== "NOTE"
      ? versUtc(parsed.data.startAt, decalage)
      : null;

  return {
    type: parsed.data.type,
    title: parsed.data.title,
    // Un modele qui rend un contenu vide n'a rien reformate: on garde la parole
    // de l'utilisateur plutot que de l'effacer.
    content: parsed.data.content || texte,
    categoryId,
    newCategoryName,
    startAt: startAt ? startAt.toISOString() : null,
  };
};
