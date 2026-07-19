import { z } from "zod";

// Limites de saisie des notes. Volontairement hors d'un fichier "use server":
// ce module n'exporte que des schemas, pas des endpoints.
//
// Pourquoi des limites: le quota Free compte des LIGNES, pas des octets. Sans
// plafond de taille, dix notes autorisees suffisent a stocker des gigaoctets.
// La validation cote client ne compte pas -- les Server Actions sont des
// endpoints HTTP publics, appelables sans passer par le formulaire.
export const TITLE_MAX = 200;
export const CONTENT_MAX = 10_000;

// Les trois types du modele fusionne. En Free l'utilisateur choisit lui-meme;
// en Premium l'IA propose. Le schema Zod est le meme dans les deux cas: une
// sortie de modele n'est pas plus digne de confiance qu'une saisie humaine.
export const NOTE_TYPES = ["NOTE", "TASK", "EVENT"] as const;

// .trim() avant .min(1): un titre fait uniquement d'espaces n'est pas un titre.
const title = z
  .string()
  .trim()
  .min(1, "Le titre est obligatoire.")
  .max(TITLE_MAX, `Le titre ne peut pas depasser ${TITLE_MAX} caracteres.`);

const content = z
  .string()
  .trim()
  .max(
    CONTENT_MAX,
    `Le contenu ne peut pas depasser ${CONTENT_MAX} caracteres.`
  );

const noteType = z.enum(NOTE_TYPES);

// new Date("n'importe quoi") ne leve pas: il rend un Invalid Date, que Prisma
// refuse ensuite avec une erreur illisible. On rejette ici, avec un message.
const dateString = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Date invalide.",
  });

// Les dates sont optionnelles: une note simple n'en a pas. Elles ne devenaient
// obligatoires que parce que l'ancien formulaire en envoyait toujours.
// Chaine vide -> undefined: un <select> non renseigne envoie "", qui n'est pas
// un identifiant. L'APPARTENANCE de cette categorie est verifiee separement,
// dans l'action -- Zod ne peut valider qu'une forme, pas un proprietaire.
//
// null est accepte au meme titre que "": formData.get() rend null pour un
// champ ABSENT, et ces actions sont des endpoints publics -- on peut leur
// poster un formulaire sans ce champ. Sans ca, l'appel echouait sur un
// "Expected string, received null" qui ne dit rien a personne, alors que
// l'absence de categorie est un cas parfaitement normal.
const categoryId = z
  .string()
  .nullish()
  .transform((value) => value?.trim() || undefined);

export const createNoteSchema = z.object({
  type: noteType.default("NOTE"),
  title,
  content,
  startAt: dateString.optional(),
  endAt: dateString.optional(),
  categoryId,
});

export const updateNoteSchema = z.object({
  id: z.string().min(1),
  type: noteType,
  title,
  content,
  completed: z.boolean(),
  categoryId,
});

// Un rendez-vous sans date de debut n'est pas un rendez-vous.
export const createEventSchema = z.object({
  title,
  content,
  startAt: dateString,
  endAt: dateString,
  allDay: z.boolean().default(false),
});

// Zod agrege toutes les erreurs; on ne remonte que la premiere, la seule que
// l'utilisateur verra dans le toast.
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Saisie invalide.";
}
