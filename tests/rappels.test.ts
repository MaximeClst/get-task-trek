import { beforeEach, describe, expect, it, vi } from "vitest";

// Un cron tourne sans personne pour le regarder: ses bugs ne se manifestent
// qu'en production, sur un chemin que personne n'ouvre. C'est exactement le
// profil de code qui merite des tests.

const prisma = vi.hoisted(() => ({
  note: {
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
}));

const resend = vi.hoisted(() => ({
  emails: { send: vi.fn().mockResolvedValue({ error: null }) },
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/resend", () => ({ getResend: () => resend }));

import { FENETRE_HEURES, envoyerRappels, tachesARappeler } from "@/lib/rappels";

const MAINTENANT = new Date("2026-07-19T10:00:00Z");

function tache(p: Record<string, unknown> = {}) {
  return {
    id: "t1",
    type: "TASK",
    title: "Rappeler le plombier",
    startAt: new Date("2026-07-19T18:00:00Z"),
    completed: false,
    reminderSentAt: null,
    userId: "u1",
    user: { email: "moi@exemple.fr", name: "Maxime Celeste" },
    ...p,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.note.findMany.mockResolvedValue([]);
  prisma.note.updateMany.mockResolvedValue({ count: 1 });
  resend.emails.send.mockResolvedValue({ error: null });
});

describe("selection des taches", () => {
  it("ne prend que les TASK: Google Agenda couvre deja les rendez-vous", async () => {
    await tachesARappeler(MAINTENANT);

    const where = prisma.note.findMany.mock.calls[0][0].where;
    expect(where.type).toBe("TASK");
  });

  it("ignore les taches deja rappelees (idempotence du cron)", async () => {
    await tachesARappeler(MAINTENANT);

    const where = prisma.note.findMany.mock.calls[0][0].where;
    expect(where.reminderSentAt).toBeNull();
  });

  it("ignore les taches terminees", async () => {
    await tachesARappeler(MAINTENANT);

    const where = prisma.note.findMany.mock.calls[0][0].where;
    expect(where.completed).toBe(false);
  });

  it("reserve les rappels au Premium, verifie EN BASE", async () => {
    await tachesARappeler(MAINTENANT);

    const where = prisma.note.findMany.mock.calls[0][0].where;
    expect(where.user).toEqual({ isPremium: true });
  });

  it("borne la fenetre des DEUX cotes", async () => {
    // Sans borne basse, la premiere execution enverrait un rappel pour toutes
    // les taches en retard depuis des mois.
    await tachesARappeler(MAINTENANT);

    const where = prisma.note.findMany.mock.calls[0][0].where;
    expect(where.startAt.gte).toEqual(MAINTENANT);
    expect(where.startAt.lte).toEqual(
      new Date(MAINTENANT.getTime() + FENETRE_HEURES * 3600 * 1000),
    );
  });

  it("plafonne le nombre de taches par execution", async () => {
    await tachesARappeler(MAINTENANT);

    expect(prisma.note.findMany.mock.calls[0][0].take).toBeGreaterThan(0);
  });
});

describe("envoi", () => {
  it("envoie un e-mail et compte le succes", async () => {
    prisma.note.findMany.mockResolvedValue([tache()]);

    const resultat = await envoyerRappels(MAINTENANT);

    expect(resend.emails.send).toHaveBeenCalledTimes(1);
    expect(resultat).toEqual({ candidates: 1, envoyes: 1, echecs: 0 });
  });

  it("reserve AVANT d'envoyer, pas apres", async () => {
    // Envoyer puis horodater laisse une fenetre ou deux executions
    // simultanees envoient le meme e-mail deux fois.
    const ordre: string[] = [];
    prisma.note.findMany.mockResolvedValue([tache()]);
    prisma.note.updateMany.mockImplementation(async () => {
      ordre.push("reserve");
      return { count: 1 };
    });
    resend.emails.send.mockImplementation(async () => {
      ordre.push("envoi");
      return { error: null };
    });

    await envoyerRappels(MAINTENANT);

    expect(ordre).toEqual(["reserve", "envoi"]);
  });

  it("la reservation est conditionnee a reminderSentAt null", async () => {
    // C'est cette condition dans le WHERE qui rend la reservation atomique.
    prisma.note.findMany.mockResolvedValue([tache()]);

    await envoyerRappels(MAINTENANT);

    expect(prisma.note.updateMany).toHaveBeenCalledWith({
      where: { id: "t1", reminderSentAt: null },
      data: { reminderSentAt: MAINTENANT },
    });
  });

  it("n'envoie pas si une autre execution a deja reserve", async () => {
    prisma.note.findMany.mockResolvedValue([tache()]);
    prisma.note.updateMany.mockResolvedValue({ count: 0 });

    const resultat = await envoyerRappels(MAINTENANT);

    expect(resend.emails.send).not.toHaveBeenCalled();
    expect(resultat.envoyes).toBe(0);
  });

  it("saute une tache dont le compte n'a pas d'e-mail, sans la reserver", async () => {
    prisma.note.findMany.mockResolvedValue([
      tache({ user: { email: null, name: null } }),
    ]);

    await envoyerRappels(MAINTENANT);

    expect(resend.emails.send).not.toHaveBeenCalled();
    expect(prisma.note.updateMany).not.toHaveBeenCalled();
  });
});

describe("echecs d'envoi", () => {
  it("traite une erreur RENDUE par Resend comme un echec", async () => {
    // Le SDK Resend ne leve pas sur une erreur d'API: il la rend dans `error`.
    // Ne tester que le try/catch laisserait passer les echecs les plus
    // courants (domaine non verifie, quota depasse) comme des succes.
    prisma.note.findMany.mockResolvedValue([tache()]);
    resend.emails.send.mockResolvedValue({
      error: { message: "Domain not verified" },
    });

    const resultat = await envoyerRappels(MAINTENANT);

    expect(resultat).toEqual({ candidates: 1, envoyes: 0, echecs: 1 });
  });

  it("relache la reservation quand l'envoi echoue, pour reessayer plus tard", async () => {
    prisma.note.findMany.mockResolvedValue([tache()]);
    resend.emails.send.mockRejectedValue(new Error("réseau"));

    await envoyerRappels(MAINTENANT);

    expect(prisma.note.updateMany).toHaveBeenLastCalledWith({
      where: { id: "t1" },
      data: { reminderSentAt: null },
    });
  });

  it("un echec n'interrompt pas les envois suivants", async () => {
    prisma.note.findMany.mockResolvedValue([
      tache({ id: "t1" }),
      tache({ id: "t2" }),
    ]);
    resend.emails.send
      .mockRejectedValueOnce(new Error("réseau"))
      .mockResolvedValueOnce({ error: null });

    const resultat = await envoyerRappels(MAINTENANT);

    expect(resultat).toEqual({ candidates: 2, envoyes: 1, echecs: 1 });
  });
});
