import { describe, expect, it } from "vitest";
import {
  resoudreCategorie,
  sortieTriSchema,
  versUtc,
} from "@/lib/validationTri";

// Une sortie de modele n'est pas plus digne de confiance qu'une saisie de
// formulaire. Elle traverse la meme porte: Zod d'abord, appartenance ensuite,
// ecriture en dernier.

describe("versUtc", () => {
  it("convertit une heure locale en instant UTC", () => {
    // La Reunion = UTC+4, donc getTimezoneOffset() vaut -240.
    expect(versUtc("2026-07-23T14:00:00", -240)?.toISOString()).toBe(
      "2026-07-23T10:00:00.000Z",
    );
    // Paris en ete = UTC+2.
    expect(versUtc("2026-07-23T14:00:00", -120)?.toISOString()).toBe(
      "2026-07-23T12:00:00.000Z",
    );
    expect(versUtc("2026-07-23T14:00:00", 0)?.toISOString()).toBe(
      "2026-07-23T14:00:00.000Z",
    );
  });

  it("rend null plutot qu'une Invalid Date", () => {
    // new Date("n'importe quoi") ne leve pas: il rend un Invalid Date, que
    // Prisma refuse ensuite avec une erreur illisible.
    expect(versUtc("jeudi prochain", 0)).toBeNull();
  });

  it("rejette une annee absurde", () => {
    expect(versUtc("4500-01-01T00:00:00", 0)).toBeNull();
    expect(versUtc("1200-01-01T00:00:00", 0)).toBeNull();
  });
});

describe("sortieTriSchema", () => {
  const base = {
    type: "TASK",
    title: "Titre",
    content: "Contenu",
    categoryId: null,
    newCategoryName: null,
    startAt: null,
  };

  it("tronque un titre trop long au lieu de tout rejeter", () => {
    // Un titre de 300 caracteres est cosmetique: faire echouer le tri entier
    // pour ca rendrait la main a l'utilisateur pour rien.
    const parsed = sortieTriSchema.safeParse({ ...base, title: "x".repeat(300) });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.title).toHaveLength(200);
  });

  it("rejette un type hors enum", () => {
    expect(sortieTriSchema.safeParse({ ...base, type: "RENDEZ_VOUS" }).success).toBe(
      false,
    );
  });

  it("rejette un titre vide", () => {
    expect(sortieTriSchema.safeParse({ ...base, title: "   " }).success).toBe(false);
  });

  it("ramene une date non ISO a null sans faire echouer le tri", () => {
    const parsed = sortieTriSchema.safeParse({ ...base, startAt: "jeudi" });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.startAt).toBeNull();
  });
});

describe("resoudreCategorie", () => {
  const miennes = new Set(["cat_a", "cat_b"]);

  it("ignore un categoryId qui appartient a un autre compte", () => {
    // LE point: le modele a recu des identifiants, rien ne garantit qu'il en
    // rende un. Un identifiant inconnu ne doit pas pouvoir ecrire.
    expect(
      resoudreCategorie(
        { categoryId: "cat_dun_autre", newCategoryName: null },
        miennes,
      ).categoryId,
    ).toBeNull();
  });

  it("ignore un categoryId hallucine", () => {
    expect(
      resoudreCategorie({ categoryId: "Courses", newCategoryName: null }, miennes)
        .categoryId,
    ).toBeNull();
  });

  it("conserve un categoryId legitime", () => {
    expect(
      resoudreCategorie({ categoryId: "cat_a", newCategoryName: null }, miennes)
        .categoryId,
    ).toBe("cat_a");
  });

  it("fait gagner une categorie existante sur une creation", () => {
    // Sinon on accumule "Courses", "Course", "Courses maison".
    expect(
      resoudreCategorie(
        { categoryId: "cat_a", newCategoryName: "Courses" },
        miennes,
      ).newCategoryName,
    ).toBeNull();
  });

  it("retombe sur la creation proposee quand l'identifiant est refuse", () => {
    const resolu = resoudreCategorie(
      { categoryId: "cat_dun_autre", newCategoryName: "Sante" },
      miennes,
    );

    expect(resolu.categoryId).toBeNull();
    expect(resolu.newCategoryName).toBe("Sante");
  });
});
