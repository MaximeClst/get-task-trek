import { beforeEach, describe, expect, it, vi } from "vitest";

// Enjeu RGPD, pas confort. La v1 enumerait les tables a vider a la main et en
// oubliait deux: tout utilisateur ayant au moins une note se prenait un P2003
// et ne POUVAIT PAS supprimer son compte.
//
// Ce test ne verifie pas la cascade Postgres elle-meme (c'est le role de la
// migration), mais la propriete qui a ete le bug: la suppression est UN SEUL
// delete, sans liste manuelle a maintenir. Une regression ici ressemblerait a
// quelqu'un qui re-enumere les tables.

const prisma = vi.hoisted(() => ({
  user: { delete: vi.fn().mockResolvedValue({ id: "moi" }) },
  note: { deleteMany: vi.fn() },
  category: { deleteMany: vi.fn() },
  subscription: { deleteMany: vi.fn() },
  account: { deleteMany: vi.fn() },
  session: { deleteMany: vi.fn() },
}));

const nextAuth = vi.hoisted(() => ({ getServerSession: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("next-auth", () => nextAuth);
vi.mock("@/lib/AuthOptions", () => ({ authOptions: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getUser: vi.fn() }));

import { deleteUser } from "@/lib/actionsUsers";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.delete.mockResolvedValue({ id: "moi" });
  nextAuth.getServerSession.mockResolvedValue({ user: { id: "moi" } });
});

describe("deleteUser", () => {
  it("supprime le compte de l'utilisateur authentifie", async () => {
    await deleteUser();

    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "moi" } });
  });

  it("ne vide aucune table a la main: c'est la cascade qui s'en charge", async () => {
    // La liste manuelle ETAIT le bug -- elle demandait qu'on pense a la mettre
    // a jour a chaque nouveau modele. La cascade est declaree a cote de la
    // relation et ne peut pas etre oubliee.
    await deleteUser();

    expect(prisma.note.deleteMany).not.toHaveBeenCalled();
    expect(prisma.category.deleteMany).not.toHaveBeenCalled();
    expect(prisma.subscription.deleteMany).not.toHaveBeenCalled();
    expect(prisma.account.deleteMany).not.toHaveBeenCalled();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it("n'accepte aucun identifiant en argument", async () => {
    // Un userId en parametre ferait de cette action un bouton "supprimer le
    // compte de n'importe qui", joignable en une requete HTTP.
    expect(deleteUser.length).toBe(0);
  });

  it("refuse quand personne n'est connecte", async () => {
    nextAuth.getServerSession.mockResolvedValue(null);

    await expect(deleteUser()).rejects.toThrow(/not authenticated/);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("remonte l'erreur si la suppression echoue", async () => {
    // Un P2003 doit se voir, pas etre avale: l'utilisateur croirait son compte
    // supprime alors qu'il ne l'est pas.
    prisma.user.delete.mockRejectedValue(new Error("P2003"));

    await expect(deleteUser()).rejects.toThrow("P2003");
  });
});
