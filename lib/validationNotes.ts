import { z } from "zod";

// Limites de saisie des notes. Volontairement hors d'un fichier "use server":
// ce module n'exporte que des schemas, pas des endpoints.
//
// Pourquoi des limites: le quota Free compte des LIGNES, pas des octets. Sans
// plafond de taille, dix notes autorisees suffisent a stocker des gigaoctets.
// La validation cote client ne compte pas -- les Server Actions sont des
// endpoints HTTP publics, appelables sans passer par le formulaire.
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 10_000;

// .trim() avant .min(1): un titre fait uniquement d'espaces n'est pas un titre.
const title = z
  .string()
  .trim()
  .min(1, "Le titre est obligatoire.")
  .max(TITLE_MAX, `Le titre ne peut pas depasser ${TITLE_MAX} caracteres.`);

const description = z
  .string()
  .trim()
  .max(
    DESCRIPTION_MAX,
    `La description ne peut pas depasser ${DESCRIPTION_MAX} caracteres.`
  );

// new Date("n'importe quoi") ne leve pas: il rend un Invalid Date, que Prisma
// refuse ensuite avec une erreur illisible. On rejette ici, avec un message.
const dateString = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Date invalide.",
  });

export const createNoteSchema = z.object({
  title,
  description,
  start: dateString,
  end: dateString,
});

export const updateNoteSchema = z.object({
  id: z.string().min(1),
  title,
  description,
  completed: z.boolean(),
});

// Zod agrege toutes les erreurs; on ne remonte que la premiere, la seule que
// l'utilisateur verra dans le toast.
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Saisie invalide.";
}
