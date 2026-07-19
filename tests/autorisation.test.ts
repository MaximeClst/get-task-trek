import { beforeEach, describe, expect, it, vi } from "vitest";

// La regle qui a coule la v1: une Server Action est un endpoint HTTP public.
// Cinq d'entre elles etaient exploitables en IDOR.
//
// Ce que ces tests verifient n'est PAS "l'action refuse un intrus" -- c'est
// plus strict: le userId doit etre dans le WHERE de la requete. Un
// findUnique({id}) suivi d'un test laisserait une fenetre entre la lecture et
// la verification, et surtout revelerait l'existence de la ressource.

const prisma = vi.hoisted(() => ({
  note: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "n1", type: "NOTE" }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    count: vi.fn().mockResolvedValue(0),
  },
  category: { findFirst: vi.fn().mockResolvedValue(null) },
}));

const session = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/session", () => session);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  // redirect() leve NEXT_REDIRECT en vrai; on reproduit le fait qu'il
  // interrompt l'execution, sinon le code apres continuerait.
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/rateLimit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/calendrierAuto", () => ({ pousserSiPremium: vi.fn() }));
vi.mock("@/lib/google", () => ({
  pousserEvenement: vi.fn(),
  supprimerEvenement: vi.fn(),
}));

import {
  createNote,
  deleteNote,
  getAllNotes,
  getNote,
  updateNote,
} from "@/lib/actionsNotes";

const MOI = { id: "moi", isPremium: false };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.note.findMany.mockResolvedValue([]);
  prisma.note.findFirst.mockResolvedValue(null);
  prisma.note.deleteMany.mockResolvedValue({ count: 1 });
  prisma.note.updateMany.mockResolvedValue({ count: 1 });
  prisma.note.count.mockResolvedValue(0);
  prisma.note.create.mockResolvedValue({ id: "n1", type: "NOTE" });
  session.getUser.mockResolvedValue(MOI);
});

describe("lecture", () => {
  it("getAllNotes ne rend que les notes de l'utilisateur", async () => {
    await getAllNotes();

    const where = prisma.note.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("moi");
  });

  it("getNote filtre sur userId DANS la requete, pas apres", async () => {
    await getNote("note-d-un-autre");

    // findFirst avec userId, et surtout PAS findUnique({ where: { id } }).
    expect(prisma.note.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "note-d-un-autre", userId: "moi" },
      }),
    );
  });

  it("n'accepte jamais un userId venant de l'appelant", async () => {
    // La signature ne prend qu'un id: il n'y a pas d'argument userId a
    // falsifier. C'est la protection la plus solide -- structurelle.
    expect(getNote.length).toBe(1);
  });
});

describe("suppression", () => {
  it("deleteNote porte le userId dans le WHERE", async () => {
    const fd = new FormData();
    fd.set("id", "note-d-un-autre");

    await deleteNote(fd);

    expect(prisma.note.deleteMany).toHaveBeenCalledWith({
      where: { id: "note-d-un-autre", userId: "moi" },
    });
  });

  it("rend le meme message pour une note inexistante et celle d'un autre", async () => {
    // Distinguer les deux revelerait quelles notes existent chez les autres.
    prisma.note.deleteMany.mockResolvedValue({ count: 0 });

    const fd = new FormData();
    fd.set("id", "peu-importe");

    await expect(deleteNote(fd)).rejects.toThrow("Note introuvable.");
  });
});

describe("modification", () => {
  it("updateNote porte le userId dans le WHERE", async () => {
    const fd = new FormData();
    fd.set("id", "note-d-un-autre");
    fd.set("type", "NOTE");
    fd.set("title", "Detourne");
    fd.set("content", "");

    // redirect() leve a la fin: c'est le comportement normal.
    await expect(updateNote(fd)).rejects.toThrow("NEXT_REDIRECT");

    expect(prisma.note.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "note-d-un-autre", userId: "moi" },
      }),
    );
  });

  it("echoue quand la note appartient a un autre", async () => {
    prisma.note.updateMany.mockResolvedValue({ count: 0 });

    const fd = new FormData();
    fd.set("id", "note-d-un-autre");
    fd.set("type", "NOTE");
    fd.set("title", "Detourne");
    fd.set("content", "");

    await expect(updateNote(fd)).rejects.toThrow("Note introuvable.");
  });
});

describe("categories", () => {
  it("refuse un categoryId qui appartient a un autre compte", async () => {
    // La cle etrangere ne verifie que l'EXISTENCE, pas le proprietaire: sans
    // cette verification, on rattache ses notes aux categories d'autrui.
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(
      createNote({
        title: "Ma note",
        content: "",
        categoryId: "categorie-d-un-autre",
      }),
    ).rejects.toThrow("Categorie introuvable.");

    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it("verifie l'appartenance avec le userId dans le WHERE", async () => {
    prisma.category.findFirst.mockResolvedValue({ id: "cat1" });

    await createNote({ title: "Ma note", content: "", categoryId: "cat1" });

    expect(prisma.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cat1", userId: "moi" } }),
    );
  });
});

describe("quota du tier gratuit", () => {
  it("refuse la 11e note d'un compte gratuit", async () => {
    prisma.note.count.mockResolvedValue(10);

    await expect(createNote({ title: "La onzieme", content: "" })).rejects.toThrow(
      /limite de 10 notes/,
    );
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it("laisse passer un compte premium au-dela de 10", async () => {
    session.getUser.mockResolvedValue({ id: "moi", isPremium: true });
    prisma.note.count.mockResolvedValue(500);

    await createNote({ title: "La cinq-cent-unieme", content: "" });
    expect(prisma.note.create).toHaveBeenCalledTimes(1);
  });

  it("compte les notes de CET utilisateur, pas toutes", async () => {
    await createNote({ title: "Note", content: "" });

    expect(prisma.note.count).toHaveBeenCalledWith({
      where: { userId: "moi" },
    });
  });

  it("ne laisse pas un compte gratuit se declarer trie par l'IA", async () => {
    // classifiedByAi vient du client: il est croise avec isPremium lu en base.
    await createNote({ title: "Note", content: "", classifiedByAi: true });

    const data = prisma.note.create.mock.calls[0][0].data;
    expect(data.classifiedByAi).toBe(false);
  });
});
