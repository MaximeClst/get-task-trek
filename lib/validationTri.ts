import { z } from "zod";
import { CONTENT_MAX, NOTE_TYPES, TITLE_MAX } from "./validationNotes";

// Validation de la sortie du modele de tri.
//
// Volontairement hors d'un fichier "use server": ce module n'exporte que des
// schemas et des fonctions pures, pas des endpoints.
//
// Le principe: une reponse de modele n'est pas plus digne de confiance qu'une
// saisie de formulaire. Elle traverse donc exactement la meme porte -- Zod
// d'abord, verification d'appartenance ensuite, ecriture en dernier. Un modele
// qui hallucine un categoryId ne doit pas pouvoir ecrire.

// gpt-4o-mini: le tri est une tache de classification courte et cadree, pas de
// la redaction. Le transcript fait au plus ~2 min de parole (~600 mots), donc
// l'appel coute de l'ordre de 0,0002 $ -- negligeable devant Whisper, qui est
// deja plafonne (lib/quotaTranscription.ts).
export const TRI_MODEL = "gpt-4o-mini";

// Le decalage horaire vient du navigateur (getTimezoneOffset). Ce n'est pas une
// donnee sensible -- au pire l'utilisateur date mal SA propre note -- mais on
// borne quand meme: les decalages reels vont de -12 h a +14 h.
export const DECALAGE_MIN = -14 * 60;
export const DECALAGE_MAX = 12 * 60;

export const decalageSchema = z
  .number()
  .int()
  .min(DECALAGE_MIN)
  .max(DECALAGE_MAX)
  .catch(0);

// Schema JSON envoye a OpenAI en mode `strict`. Il contraint la FORME de la
// reponse a la source, ce qui evite la plupart des allers-retours rates -- mais
// il ne remplace pas la validation ci-dessous: strict garantit la structure,
// jamais le contenu (un categoryId bien forme peut designer n'importe quoi).
//
// Contraintes du mode strict: toutes les proprietes dans `required`, et
// `additionalProperties: false`. Un champ optionnel se represente donc par un
// type nullable, pas par une absence.
export const TRI_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "title", "content", "categoryId", "newCategoryName", "startAt"],
  properties: {
    type: {
      type: "string",
      enum: [...NOTE_TYPES],
      description:
        "NOTE pour une information a garder, TASK pour une action a faire, EVENT pour un rendez-vous a une date et une heure precises.",
    },
    title: {
      type: "string",
      description: `Titre court et explicite, ${TITLE_MAX} caracteres maximum, sans point final.`,
    },
    content: {
      type: "string",
      description:
        "Le transcript reformate: ponctuation corrigee, hesitations retirees. Ne rien inventer, ne rien resumer, ne rien retirer du fond.",
    },
    categoryId: {
      type: ["string", "null"],
      description:
        "Identifiant d'une categorie EXISTANTE de la liste fournie, ou null. Ne jamais inventer d'identifiant.",
    },
    newCategoryName: {
      type: ["string", "null"],
      description:
        "Nom d'une categorie a creer, uniquement si aucune categorie existante ne convient. null sinon. Jamais renseigne en meme temps que categoryId.",
    },
    startAt: {
      type: ["string", "null"],
      description:
        "Date et heure LOCALES au format YYYY-MM-DDTHH:MM:SS, sans fuseau. null si la dictee n'en mentionne aucune.",
    },
  },
} as const;

// Format local attendu, sans fuseau: le modele raisonne sur l'heure locale de
// l'utilisateur, la conversion en UTC se fait ici, pas chez lui.
const DATE_LOCALE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

// Le titre est TRONQUE plutot que rejete: un titre de 210 caracteres est un
// detail cosmetique, et faire echouer tout le tri pour ca rendrait la main a
// l'utilisateur pour rien. Le contenu, lui, est verifie strictement -- s'il
// deborde, c'est que le modele a fait autre chose que reformater.
export const sortieTriSchema = z.object({
  type: z.enum(NOTE_TYPES),
  title: z
    .string()
    .trim()
    .min(1)
    .transform((valeur) => valeur.slice(0, TITLE_MAX)),
  content: z.string().trim().max(CONTENT_MAX),
  categoryId: z.string().trim().min(1).nullable().catch(null),
  newCategoryName: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .nullable()
    .catch(null),
  startAt: z
    .string()
    .trim()
    .regex(DATE_LOCALE)
    .nullable()
    .catch(null),
});

export type SortieTri = z.infer<typeof sortieTriSchema>;

// Une passe, pas un chat: le modele ne voit que le transcript et la liste des
// categories. Pas d'historique -- il serait refacture a chaque tour sans rien
// ajouter au tri.
//
// Cette fonction vit ICI et non dans l'action parce qu'un fichier "use server"
// ne peut exporter que des Server Actions: y laisser le prompt le rendrait
// intestable, alors que c'est la piece qui derive le plus vite.
export function construireInstructions(
  maintenantLocal: string,
  categories: { id: string; name: string }[],
): string {
  const liste =
    categories.length > 0
      ? categories.map((c) => `- ${c.id} : ${c.name}`).join("\n")
      : "(aucune categorie n'existe encore)";

  return [
    "Tu tries des notes dictees en francais. Tu reponds uniquement en JSON.",
    "",
    `Nous sommes le ${maintenantLocal}, heure locale de l'utilisateur.`,
    "Toute date relative (demain, jeudi prochain, dans deux semaines) se calcule",
    "a partir de cet instant. Si aucune heure n'est dite pour un rendez-vous,",
    "utilise 09:00.",
    "",
    "Categories existantes de l'utilisateur :",
    liste,
    "",
    "Regles :",
    "- EVENT seulement si la dictee mentionne un moment precis ou datable.",
    "- TASK si une action est a faire, meme sans date.",
    "- NOTE dans tous les autres cas.",
    "- categoryId doit etre l'un des identifiants ci-dessus, copie a l'identique.",
    "  Si aucune ne convient vraiment, laisse categoryId a null.",
    "- newCategoryName seulement si aucune categorie existante ne convient ET",
    "  que la note appartient clairement a un theme recurrent. Sinon null.",
    "- content reprend le transcript avec la ponctuation corrigee. N'invente",
    "  rien, ne resume pas.",
  ].join("\n");
}

// LA fonction qui empeche un modele d'ecrire n'importe ou. Le modele a recu des
// identifiants; rien ne garantit qu'il en rende un. On verifie l'appartenance
// contre la liste qu'on vient de lire pour CET utilisateur -- deja en memoire,
// donc sans aller-retour supplementaire vers Frankfurt.
//
// Un identifiant inconnu n'est pas fatal: on retombe sur "sans categorie" et
// l'utilisateur choisit. Faire echouer tout le tri parce que le modele a
// invente une categorie lui couterait sa dictee.
//
// Une categorie existante gagne toujours sur une creation: c'est ce qui empeche
// d'accumuler "Courses", "Course", "Courses maison".
export function resoudreCategorie(
  sortie: Pick<SortieTri, "categoryId" | "newCategoryName">,
  idsAutorises: Set<string>,
): { categoryId: string | null; newCategoryName: string | null } {
  const categoryId =
    sortie.categoryId && idsAutorises.has(sortie.categoryId)
      ? sortie.categoryId
      : null;

  return {
    categoryId,
    newCategoryName: categoryId ? null : sortie.newCategoryName,
  };
}

// Convertit une heure locale ("2026-07-23T14:00:00") en instant UTC, a partir du
// decalage renvoye par getTimezoneOffset (UTC - local, en minutes: -240 a La
// Reunion). Parser la chaine comme si elle etait en UTC puis reappliquer le
// decalage donne l'instant reel.
//
// Limite connue: un decalage releve MAINTENANT est applique a une date FUTURE.
// Un rendez-vous pris de part et d'autre d'un changement d'heure sera decale
// d'une heure. Sans fuseau IANA cote serveur on ne peut pas mieux faire, et
// l'utilisateur relit la date avant de valider.
export function versUtc(local: string, decalageMinutes: number): Date | null {
  const base = Date.parse(`${local}Z`);
  if (Number.isNaN(base)) return null;

  const instant = new Date(base + decalageMinutes * 60_000);

  // Une date que Prisma refuserait, ou manifestement absurde: on prefere une
  // note sans date a une note datee de l'an 4000.
  const annee = instant.getUTCFullYear();
  if (annee < 2000 || annee > 2100) return null;

  return instant;
}
