import { QUOTA_FREE_SECONDES, QUOTA_PREMIUM_SECONDES } from "./quotaTranscription";

// Description des deux offres, au meme endroit pour la page de tarifs et pour
// les reglages. Sans ca les deux ecrans derivent, et c'est celui qu'on oublie
// qui ment a l'utilisateur.
//
// La frontiere est celle du CLAUDE.md: la dictee n'est PAS ce qui separe les
// offres, le TRI l'est. Un compte gratuit dicte et transcrit; il classe et
// categorise a la main.

// ATTENTION: ce montant n'est que du TEXTE. Il n'engage rien -- c'est le Price
// Stripe designe par STRIPE_PRICE_ID_MONTHLY qui est reellement facture. Un
// Price Stripe etant immuable, changer de tarif veut dire creer un nouveau
// Price, remplacer la variable d'environnement, ET corriger cette ligne.
export const PRIX_PREMIUM = "15,99 €";

// Fonctionnalites annoncees mais pas encore livrees (roadmap 2.5 et 2.6). On
// les affiche parce qu'elles justifient le prix, mais marquees: vendre comme
// disponible ce qui ne l'est pas est la seule chose qu'on ne rattrape pas.
export type Avantage = { texte: string; bientot?: boolean };

const minutes = (secondes: number) => Math.round(secondes / 60);
const heures = (secondes: number) => Math.round(secondes / 3600);

export const OFFRE_FREE = {
  nom: "Gratuit",
  resume: "Pour essayer, et pour les petits volumes.",
  avantages: [
    { texte: `Dictée et transcription — ${minutes(QUOTA_FREE_SECONDES)} min par mois` },
    { texte: "10 notes" },
    { texte: "Catégories illimitées, créées à la main" },
    { texte: "Classement note / tâche / rendez-vous manuel" },
  ] satisfies Avantage[],
};

export const OFFRE_PREMIUM = {
  nom: "Premium",
  resume: "Treky range à votre place.",
  avantages: [
    { texte: "Notes illimitées" },
    { texte: "Treky classe et catégorise chaque dictée" },
    { texte: `Dictée et transcription — ${heures(QUOTA_PREMIUM_SECONDES)} h par mois` },
    { texte: "Ajout automatique à Google Calendar", bientot: true },
    { texte: "Rappels e-mail sur vos tâches", bientot: true },
  ] satisfies Avantage[],
};
