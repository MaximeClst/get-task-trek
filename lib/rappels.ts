import type { Note } from "@prisma/client";
import { prisma } from "./db";
import { getResend } from "./resend";

// Rappels e-mail des taches a echeance proche.
//
// Pourquoi les TACHES et pas les rendez-vous: Google Agenda notifie deja pour
// les rendez-vous. Notre valeur ajoutee est exactement la ou Google n'est pas
// -- les taches, qui ne vivent nulle part ailleurs. Envoyer un rappel pour un
// rendez-vous serait un doublon, donc une raison de se desabonner.
//
// Volontairement hors d'un fichier "use server": appelee par le cron, jamais
// depuis un navigateur.

// Fenetre d'anticipation. 24 h laisse le temps d'agir sur une tache oubliee,
// sans prevenir si tot que le rappel est oublie a son tour.
export const FENETRE_HEURES = 24;

// Plafond par execution. Le cron tourne toutes les heures: sans borne, un pic
// ferait depasser la duree maximale d'une fonction Vercel, et l'execution
// serait coupee au milieu. Ce qui deborde part au tour suivant.
export const MAX_PAR_EXECUTION = 100;

export type ResultatRappels = {
  candidates: number;
  envoyes: number;
  echecs: number;
};

type NoteAvecUtilisateur = Note & {
  user: { email: string | null; name: string | null };
};

// Selectionne les taches a rappeler.
//
// Quatre conditions, chacune pour une raison:
//   - type TASK           : les rendez-vous sont couverts par Google Agenda
//   - reminderSentAt null : c'est ce qui rend le cron idempotent
//   - completed false     : rappeler une tache faite est le meilleur moyen de
//                           passer pour un logiciel qui ne suit pas
//   - user.isPremium      : le rappel est une fonction payante, et isPremium
//                           est lu EN BASE, jamais depuis une session
export async function tachesARappeler(
  maintenant: Date,
): Promise<NoteAvecUtilisateur[]> {
  const limite = new Date(
    maintenant.getTime() + FENETRE_HEURES * 60 * 60 * 1000,
  );

  return prisma.note.findMany({
    where: {
      type: "TASK",
      completed: false,
      reminderSentAt: null,
      // Bornee des DEUX cotes: sans la borne basse, la premiere execution
      // enverrait un rappel pour toutes les taches en retard depuis des mois.
      startAt: { gte: maintenant, lte: limite },
      user: { isPremium: true },
    },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { startAt: "asc" },
    take: MAX_PAR_EXECUTION,
  });
}

// Reserve la tache AVANT l'envoi, de facon atomique.
//
// L'ordre compte. Envoyer puis horodater laisse une fenetre ou deux executions
// simultanees envoient toutes les deux le meme e-mail. Horodater d'abord ferme
// cette fenetre: la condition `reminderSentAt: null` dans le WHERE fait que
// seule la premiere des deux voit count === 1.
//
// Le prix de ce choix est qu'un envoi rate laisse la tache marquee. On le paie
// en relachant la reservation (voir relacher), ce qui la rend au tour suivant.
async function reserver(noteId: string, maintenant: Date): Promise<boolean> {
  const { count } = await prisma.note.updateMany({
    where: { id: noteId, reminderSentAt: null },
    data: { reminderSentAt: maintenant },
  });

  return count === 1;
}

async function relacher(noteId: string): Promise<void> {
  try {
    await prisma.note.updateMany({
      where: { id: noteId },
      data: { reminderSentAt: null },
    });
  } catch (error) {
    // Si meme le relachement echoue, on perd UN rappel. C'est le moindre mal:
    // l'alternative serait de reessayer en boucle dans une fonction cron.
    console.error("Relachement du rappel impossible :", error);
  }
}

function corpsEmail(note: NoteAvecUtilisateur): { sujet: string; html: string } {
  const echeance = note.startAt
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(note.startAt)
    : "bientôt";

  const prenom = note.user.name?.split(" ")[0];

  return {
    sujet: `Rappel : ${note.title}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.6">
        <p>${prenom ? `Bonjour ${prenom},` : "Bonjour,"}</p>
        <p>Une tâche arrive à échéance :</p>
        <p style="font-size:18px;font-weight:600;margin:16px 0">${note.title}</p>
        <p style="color:#666">Échéance : ${echeance} (UTC)</p>
        <p>
          <a href="${process.env.NEXT_PUBLIC_DOMAIN_URL ?? "https://get-task-trek.vercel.app"}/dashboard/notes"
             style="color:#0a7">Voir mes tâches</a>
        </p>
        <p style="color:#999;font-size:12px;margin-top:32px">
          Vous recevez ce message parce que vous êtes abonné à Task Trek Premium.
        </p>
      </div>
    `,
  };
}

// Envoie les rappels dus. Rend un compte-rendu plutot que de lever: le cron
// doit repondre 200 meme si un envoi echoue, sinon Vercel le rejoue en entier
// et les taches deja traitees repartiraient.
export async function envoyerRappels(
  maintenant: Date = new Date(),
): Promise<ResultatRappels> {
  const taches = await tachesARappeler(maintenant);

  let envoyes = 0;
  let echecs = 0;

  for (const tache of taches) {
    // Une tache sans e-mail n'est pas une erreur: le compte existe, il n'a
    // simplement pas d'adresse. On la saute sans la reserver.
    if (!tache.user.email) continue;

    if (!(await reserver(tache.id, maintenant))) {
      // Une autre execution est passee avant nous. C'est exactement ce que la
      // reservation doit produire.
      continue;
    }

    const { sujet, html } = corpsEmail(tache);

    try {
      const { error } = await getResend().emails.send({
        from: process.env.RESEND_FROM ?? "Task Trek <rappels@get-task-trek.com>",
        to: tache.user.email,
        subject: sujet,
        html,
      });

      // Le SDK Resend ne LEVE pas sur une erreur d'API: il la rend dans
      // `error`. Ne tester que le try/catch laisserait passer les echecs les
      // plus courants (domaine non verifie, quota depasse) comme des succes.
      if (error) throw new Error(error.message);

      envoyes++;
    } catch (error) {
      console.error(`Rappel non envoye pour la note ${tache.id} :`, error);
      await relacher(tache.id);
      echecs++;
    }
  }

  return { candidates: taches.length, envoyes, echecs };
}
