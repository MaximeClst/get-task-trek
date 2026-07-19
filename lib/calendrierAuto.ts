import type { Note } from "@prisma/client";
import { prisma } from "./db";
import { pousserEvenement } from "./google";

// Push automatique des rendez-vous, reserve au Premium.
//
// Volontairement HORS d'un fichier "use server": ce module est appele depuis
// createNote, pas depuis le navigateur. L'exporter comme Server Action en
// ferait un endpoint public de plus, pour rien.
//
// Regle du CLAUDE.md, et raison d'etre de ce fichier: un push qui echoue ne
// doit JAMAIS faire perdre la note. La note est ecrite d'abord, poussee
// ensuite, et l'echec est journalise sans remonter. L'utilisateur garde sa
// note et peut toujours pousser a la main.
export async function pousserSiPremium(
  note: Note,
  isPremium: boolean,
): Promise<void> {
  if (!isPremium) return;
  if (note.type !== "EVENT") return;
  if (!note.startAt) return;
  if (note.googleEventId) return;

  try {
    const googleEventId = await pousserEvenement(note);

    await prisma.note.updateMany({
      where: { id: note.id, userId: note.userId },
      data: { googleEventId },
    });
  } catch (error) {
    // Silencieux pour l'appelant, trace pour nous. Le cas le plus courant est
    // un compte qui n'a pas encore reconsenti au scope calendrier: lui faire
    // echouer sa creation de note serait disproportionne.
    console.error("Push automatique au calendrier en echec :", error);
  }
}
