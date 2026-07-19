import type { Note } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

// google.ts instancie Prisma au chargement du module.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { versEvenementGoogle } from "@/lib/google";

function note(p: Partial<Note>): Note {
  return {
    id: "n1",
    type: "EVENT",
    title: "Dentiste",
    content: "Cabinet du centre",
    startAt: null,
    endAt: null,
    allDay: false,
    completed: false,
    googleEventId: null,
    reminderSentAt: null,
    classifiedByAi: false,
    categoryId: null,
    userId: "u1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...p,
  } as Note;
}

describe("versEvenementGoogle", () => {
  it("reprend debut et fin tels quels", () => {
    const e = versEvenementGoogle(
      note({
        startAt: new Date("2026-07-24T12:30:00Z"),
        endAt: new Date("2026-07-24T13:15:00Z"),
      }),
    ) as never as { start: { dateTime: string }; end: { dateTime: string } };

    expect(e.start.dateTime).toBe("2026-07-24T12:30:00.000Z");
    expect(e.end.dateTime).toBe("2026-07-24T13:15:00.000Z");
  });

  it("donne une heure par defaut sans endAt", () => {
    // Google refuse un evenement sans date de fin: inventer une duree est
    // moins mauvais que refuser le push.
    const e = versEvenementGoogle(
      note({ startAt: new Date("2026-07-24T12:30:00Z") }),
    ) as never as { end: { dateTime: string } };

    expect(e.end.dateTime).toBe("2026-07-24T13:30:00.000Z");
  });

  it("journee entiere: la date de fin est EXCLUSIVE", () => {
    // LE bug qui ne se voit pas en relisant le code. Nos donnees stockent la
    // fin a 23:59:59 le meme jour; recopiee telle quelle, elle donnait un
    // evenement de duree nulle, absent de l'agenda.
    const e = versEvenementGoogle(
      note({
        allDay: true,
        startAt: new Date("2026-07-23T00:00:00Z"),
        endAt: new Date("2026-07-23T23:59:59Z"),
      }),
    ) as never as { start: { date: string }; end: { date: string } };

    expect(e.start.date).toBe("2026-07-23");
    expect(e.end.date).toBe("2026-07-24");
  });

  it("journee entiere sur plusieurs jours", () => {
    const e = versEvenementGoogle(
      note({
        allDay: true,
        startAt: new Date("2026-07-23T00:00:00Z"),
        endAt: new Date("2026-07-25T23:59:59Z"),
      }),
    ) as never as { end: { date: string } };

    expect(e.end.date).toBe("2026-07-26");
  });

  it("journee entiere sans endAt couvre bien un jour", () => {
    const e = versEvenementGoogle(
      note({ allDay: true, startAt: new Date("2026-07-23T00:00:00Z") }),
    ) as never as { end: { date: string } };

    expect(e.end.date).toBe("2026-07-24");
  });

  it("journee entiere n'envoie pas de dateTime", () => {
    // Melanger `date` et `dateTime` fait rejeter la requete par Google.
    const e = versEvenementGoogle(
      note({ allDay: true, startAt: new Date("2026-07-23T00:00:00Z") }),
    ) as never as { start: Record<string, unknown> };

    expect(e.start.dateTime).toBeUndefined();
  });

  it("rend undefined et jamais null pour un contenu vide", () => {
    // Google refuse une description a null.
    const e = versEvenementGoogle(
      note({ startAt: new Date("2026-07-24T12:00:00Z"), content: null }),
    ) as never as { description?: string };

    expect(e.description).toBeUndefined();
  });
});
