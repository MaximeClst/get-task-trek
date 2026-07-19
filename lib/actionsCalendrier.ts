"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { ErreurCalendrier, pousserEvenement, supprimerEvenement } from "./google";
import { enforceRateLimit } from "./rateLimit";
import { getUser } from "./session";

// Ajout des rendez-vous a Google Calendar.
//
// Ouvert a TOUS: le CLAUDE.md place la frontiere sur l'AUTOMATISATION, pas sur
// la fonctionnalite. Un compte gratuit pousse ses rendez-vous a la main, un
// compte Premium les voit partir tout seuls (voir pousserSiPremium).

const MESSAGE_RECONSENT =
  "Task Trek n'a pas encore accès à votre agenda. Déconnectez-vous puis reconnectez-vous avec Google pour l'autoriser.";

function messagePour(error: unknown): string {
  if (error instanceof ErreurCalendrier) {
    return error.raison === "RECONSENT"
      ? MESSAGE_RECONSENT
      : "Google Calendar est momentanément indisponible. Réessayez.";
  }
  return "L'ajout au calendrier a échoué.";
}

export const pousserNoteAuCalendrier = async (formData: FormData) => {
  const user = await getUser();
  const id = formData.get("id") as string;

  await enforceRateLimit("calendrier", user.id);

  // userId dans le WHERE: la note d'un autre ne correspond a rien, plutot que
  // d'etre lue puis testee apres coup.
  const note = await prisma.note.findFirst({
    where: { id, userId: user.id },
  });

  if (!note) {
    throw new Error("Note introuvable.");
  }

  if (note.type !== "EVENT") {
    throw new Error("Seuls les rendez-vous vont au calendrier.");
  }

  if (!note.startAt) {
    throw new Error("Ce rendez-vous n'a pas de date.");
  }

  let googleEventId: string;
  try {
    googleEventId = await pousserEvenement(note);
  } catch (error) {
    console.error("Push calendrier en echec :", error);
    throw new Error(messagePour(error));
  }

  // La projection n'est enregistree qu'APRES confirmation par Google: ecrire
  // l'identifiant avant nous ferait croire a un evenement qui n'existe pas, et
  // le prochain push tenterait un PATCH sur du vide.
  await prisma.note.updateMany({
    where: { id: note.id, userId: user.id },
    data: { googleEventId },
  });

  revalidatePath("/dashboard/notes");
  revalidatePath("/dashboard/calendar");
};

export const retirerNoteDuCalendrier = async (formData: FormData) => {
  const user = await getUser();
  const id = formData.get("id") as string;

  await enforceRateLimit("calendrier", user.id);

  const note = await prisma.note.findFirst({
    where: { id, userId: user.id },
    select: { id: true, googleEventId: true },
  });

  if (!note?.googleEventId) {
    throw new Error("Ce rendez-vous n'est pas dans votre agenda.");
  }

  try {
    await supprimerEvenement(user.id, note.googleEventId);
  } catch (error) {
    console.error("Retrait du calendrier en echec :", error);
    throw new Error(messagePour(error));
  }

  await prisma.note.updateMany({
    where: { id: note.id, userId: user.id },
    data: { googleEventId: null },
  });

  revalidatePath("/dashboard/notes");
  revalidatePath("/dashboard/calendar");
};
