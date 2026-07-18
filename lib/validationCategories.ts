import { z } from "zod";

export const CATEGORY_NAME_MAX = 50;

// Plafond anti-abus, pas un quota produit. Les categories sont gratuites et
// illimitees dans l'esprit de l'offre; ce nombre existe pour qu'un script ne
// puisse pas en creer cent mille. Personne n'organise sa vie en 50 categories.
export const CATEGORY_MAX_PER_USER = 50;

// Palette proposee dans l'UI. La validation n'y est PAS restreinte -- on accepte
// n'importe quel hexadecimal a 6 chiffres -- mais elle donne des couleurs
// coherentes sans demander a l'utilisateur de choisir un code hexa.
export const CATEGORY_COLORS = [
  "#64748b", // ardoise (defaut)
  "#ef4444", // rouge
  "#f97316", // orange
  "#eab308", // jaune
  "#22c55e", // vert
  "#06b6d4", // cyan
  "#3b82f6", // bleu
  "#a855f7", // violet
  "#ec4899", // rose
] as const;

const name = z
  .string()
  .trim()
  .min(1, "Le nom est obligatoire.")
  .max(
    CATEGORY_NAME_MAX,
    `Le nom ne peut pas depasser ${CATEGORY_NAME_MAX} caracteres.`
  );

// Cette couleur finit dans un attribut `style`. Restreindre a un hexadecimal
// strict evite d'y laisser passer autre chose qu'une couleur.
const color = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.")
  .default("#64748b");

export const createCategorySchema = z.object({ name, color });

export const updateCategorySchema = z.object({
  id: z.string().min(1),
  name,
  color,
});
