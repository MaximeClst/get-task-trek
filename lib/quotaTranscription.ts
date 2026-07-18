import { prisma } from "./db";

// Plafond MENSUEL de transcription, en secondes d'audio.
//
// Le limiteur de debit (lib/rateLimit.ts) empeche la rafale: 20 dictees par
// heure. Il n'empeche PAS la consommation lente et continue -- vingt dictees
// par heure, toute la journee, tous les jours, ca fait beaucoup d'argent. Et
// comme on ne peut pas bloquer le multi-compte Google, la seule limite qui
// tienne est celle de la consommation cumulee.
//
// On compte des SECONDES REELLES, pas des appels: une dictee de 5 secondes ne
// doit pas couter autant qu'une de deux minutes. La duree est celle que
// renvoie Whisper apres traitement, donc la duree facturee -- pas une valeur
// annoncee par le navigateur, qui mentirait.

const SECONDES_PAR_MOIS = 30 * 24 * 3600;

// Whisper coute ~0,006 $/min. Ces deux nombres sont un ARBITRAGE PRODUIT, pas
// une contrainte technique: ils se changent ici, sur une ligne.
//
//   Free    : 30 min  -> ~0,18 $/mois par compte gratuit. C'est le cout
//             d'acquisition assume d'un utilisateur qui ne paie pas.
//   Premium : 10 h    -> ~3,60 $/mois, contre 15,99 EUR encaisses. Large, et
//             tres au-dessus d'un usage reel (10 h de dictee dans un mois).
export const QUOTA_FREE_SECONDES = 30 * 60;
export const QUOTA_PREMIUM_SECONDES = 10 * 3600;

export function quotaPour(isPremium: boolean): number {
  return isPremium ? QUOTA_PREMIUM_SECONDES : QUOTA_FREE_SECONDES;
}

function cleDe(userId: string): string {
  return `transcriptionSeconds:${userId}`;
}

function debutFenetre(): Date {
  const ms = SECONDES_PAR_MOIS * 1000;
  return new Date(Math.floor(Date.now() / ms) * ms);
}

export type UsageTranscription = {
  utiliseSecondes: number;
  quotaSecondes: number;
  restantSecondes: number;
  renouvelleLe: Date;
};

// Lecture seule: sert au controle AVANT l'appel, et a l'affichage.
export async function lireUsage(
  userId: string,
  isPremium: boolean
): Promise<UsageTranscription> {
  const quotaSecondes = quotaPour(isPremium);
  const fenetre = debutFenetre();

  const ligne = await prisma.rateLimit.findUnique({
    where: { key: cleDe(userId) },
  });

  // Une ligne d'une fenetre passee vaut zero: le compteur repart au mois
  // suivant sans qu'on ait besoin de nettoyer quoi que ce soit.
  const utiliseSecondes =
    ligne && ligne.windowStart >= fenetre ? ligne.count : 0;

  return {
    utiliseSecondes,
    quotaSecondes,
    restantSecondes: Math.max(0, quotaSecondes - utiliseSecondes),
    renouvelleLe: new Date(fenetre.getTime() + SECONDES_PAR_MOIS * 1000),
  };
}

// Ecriture APRES l'appel, avec la duree reellement facturee par OpenAI.
//
// Consequence assumee: un compte a 99 % de son quota peut encore lancer une
// dictee, et depasser d'au plus la duree maximale d'un enregistrement (2 min).
// Le depassement est donc borne, et connu. L'inverse -- refuser avant de
// connaitre la duree -- obligerait a estimer, donc a se tromper dans un sens
// ou dans l'autre.
export async function ajouterSecondes(
  userId: string,
  secondes: number
): Promise<void> {
  const arrondi = Math.max(1, Math.ceil(secondes));
  const fenetre = debutFenetre();
  const key = cleDe(userId);

  try {
    // Meme upsert atomique que le limiteur de debit: c'est Postgres qui
    // additionne, en un aller-retour. Deux dictees simultanees ne peuvent pas
    // s'ecraser l'une l'autre.
    await prisma.$executeRaw`
      INSERT INTO "RateLimit" ("key", "count", "windowStart")
      VALUES (${key}, ${arrondi}, ${fenetre})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."windowStart" < ${fenetre} THEN ${arrondi}
          ELSE "RateLimit"."count" + ${arrondi}
        END,
        "windowStart" = CASE
          WHEN "RateLimit"."windowStart" < ${fenetre} THEN ${fenetre}
          ELSE "RateLimit"."windowStart"
        END
    `;
  } catch (error) {
    // On ne fait PAS echouer une transcription deja payee et reussie parce que
    // la comptabilisation a echoue. On perd une mesure, l'utilisateur garde
    // son texte -- et l'erreur est tracee.
    console.error("Comptabilisation du quota impossible :", error);
  }
}
