import { beforeEach, describe, expect, it, vi } from "vitest";

// Les deux bugs de facturation de la v1 vivaient ici, et ils perdaient de
// l'argent dans les DEUX sens: un abonnement resilie laissait `isPremium` a
// true a vie, et un reabonnement faisait planter le webhook sur la contrainte
// unique -- le client payait sans recuperer son acces.
//
// Ces tests existent pour que ces deux-la ne reviennent jamais.

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  subscription: { upsert: vi.fn() },
  // $transaction recoit un tableau de promesses deja lancees: les appels aux
  // stubs ont donc DEJA eu lieu quand on arrive ici. Les inspecter suffit.
  $transaction: vi.fn(async (operations: unknown[]) => operations),
}));

const stripeSdk = vi.hoisted(() => ({
  subscriptions: { list: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/stripe", () => ({ stripe: stripeSdk }));

import {
  abonnementActifChezStripe,
  grantsPremium,
  reconcilierAvecStripe,
  syncSubscription,
} from "@/lib/abonnement";

// Le minimum qu'attend syncSubscription d'un objet Stripe.Subscription.
function abonnementStripe(status: string, id = "sub_1") {
  return {
    id,
    status,
    customer: "cus_1",
    current_period_start: 1_750_000_000,
    current_period_end: 1_752_000_000,
    items: { data: [{ plan: { id: "price_1", interval: "month" } }] },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: "u1" });
});

describe("grantsPremium", () => {
  it("accorde le premium sur un abonnement actif ou en essai", () => {
    expect(grantsPremium("active")).toBe(true);
    expect(grantsPremium("trialing")).toBe(true);
  });

  it("le coupe sur tout autre statut", () => {
    // canceled etait LE cas non traite par la v1: isPremium restait true a vie.
    for (const statut of [
      "canceled",
      "unpaid",
      "past_due",
      "incomplete",
      "incomplete_expired",
      "paused",
    ] as const) {
      expect(grantsPremium(statut)).toBe(false);
    }
  });
});

describe("syncSubscription", () => {
  it("passe l'utilisateur en premium quand l'abonnement est actif", async () => {
    await syncSubscription(abonnementStripe("active"));

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { isPremium: true },
    });
  });

  it("RETIRE le premium a la resiliation (le bug de la v1)", async () => {
    await syncSubscription(abonnementStripe("canceled"));

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { isPremium: false },
    });
  });

  it("upsert et non create: un reabonnement ne viole pas la contrainte unique", async () => {
    // Au reabonnement le stripeSubscriptionId change, mais userId est @unique.
    // Un create() planterait -- et le client aurait paye pour rien.
    await syncSubscription(abonnementStripe("active", "sub_2"));

    expect(prisma.subscription.upsert).toHaveBeenCalledTimes(1);
    const appel = prisma.subscription.upsert.mock.calls[0][0];

    expect(appel.where).toEqual({ userId: "u1" });
    expect(appel.create.stripeSubscriptionId).toBe("sub_2");
    expect(appel.update.stripeSubscriptionId).toBe("sub_2");
  });

  it("ecrit isPremium et Subscription dans UNE transaction", async () => {
    // Sinon un echec entre les deux laisse un utilisateur premium sans
    // abonnement enregistre, ou l'inverse.
    await syncSubscription(abonnementStripe("active"));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("refuse un client Stripe inconnu plutot que d'ecrire au hasard", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(syncSubscription(abonnementStripe("active"))).rejects.toThrow(
      /User not found/,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("abonnementActifChezStripe", () => {
  it("ignore les abonnements resilies et rend l'actif", async () => {
    stripeSdk.subscriptions.list.mockResolvedValue({
      data: [
        abonnementStripe("canceled", "sub_vieux"),
        abonnementStripe("active", "sub_actuel"),
      ],
    });

    const trouve = await abonnementActifChezStripe("cus_1");
    expect(trouve?.id).toBe("sub_actuel");
  });

  it("rend null quand aucun abonnement n'est actif", async () => {
    stripeSdk.subscriptions.list.mockResolvedValue({
      data: [abonnementStripe("canceled")],
    });

    expect(await abonnementActifChezStripe("cus_1")).toBeNull();
  });

  it("demande TOUS les statuts, pas seulement les actifs", async () => {
    // status:"all" est necessaire pour voir un abonnement past_due ou paused,
    // qu'on veut aussi refuser de doubler.
    stripeSdk.subscriptions.list.mockResolvedValue({ data: [] });
    await abonnementActifChezStripe("cus_1");

    expect(stripeSdk.subscriptions.list).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1", status: "all" }),
    );
  });
});

describe("reconcilierAvecStripe", () => {
  it("rattrape un webhook manque: paye chez Stripe -> premium chez nous", async () => {
    stripeSdk.subscriptions.list.mockResolvedValue({
      data: [abonnementStripe("active")],
    });

    expect(await reconcilierAvecStripe("cus_1")).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { isPremium: true },
    });
  });

  it("n'accorde rien sans abonnement actif", async () => {
    stripeSdk.subscriptions.list.mockResolvedValue({ data: [] });

    expect(await reconcilierAvecStripe("cus_1")).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("sans client Stripe, ne va meme pas interroger Stripe", async () => {
    expect(await reconcilierAvecStripe(null)).toBe(false);
    expect(stripeSdk.subscriptions.list).not.toHaveBeenCalled();
  });

  it("ne casse pas la page si Stripe est injoignable", async () => {
    // La page de retour de paiement doit rester affichable: on rend "pas
    // confirme", qui est vrai, plutot que de lever une erreur a l'ecran.
    stripeSdk.subscriptions.list.mockRejectedValue(new Error("réseau"));

    expect(await reconcilierAvecStripe("cus_1")).toBe(false);
  });
});
