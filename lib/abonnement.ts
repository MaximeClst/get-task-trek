import type { Stripe } from "stripe";
import { prisma } from "./db";
import { stripe } from "./stripe";

// Alignement de l'etat local sur Stripe.
//
// Volontairement hors d'un fichier "use server" ET hors du route.ts du webhook:
// un route.ts n'exporte que des methodes HTTP (regle du CLAUDE.md, et la raison
// pour laquelle la v1 ne buildait pas). Ces fonctions servent a DEUX appelants
// -- le webhook et la page de retour de paiement -- donc elles vivent ici.

// Un abonnement donne acces au premium tant qu'il est actif (ou en essai).
// Tout autre statut (canceled, unpaid, past_due, incomplete...) le coupe.
export const grantsPremium = (status: Stripe.Subscription.Status) =>
  status === "active" || status === "trialing";

// Aligne l'etat local sur l'abonnement Stripe. Une seule fonction pour tous les
// evenements: elle est idempotente (upsert), donc un rejeu ne casse rien.
export async function syncSubscription(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = subscription.customer as string;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });
  if (!user) {
    throw new Error("User not found for customerId: " + customerId);
  }

  const premium = grantsPremium(subscription.status);

  const data = {
    status: subscription.status,
    planId: subscription.items.data[0].plan.id,
    interval: String(subscription.items.data[0].plan.interval),
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
  };

  // upsert sur userId (unique): a la resouscription, le stripeSubscriptionId
  // change mais l'utilisateur non. Un create violerait la contrainte @unique
  // sur userId -- le client paierait sans recuperer son acces.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { isPremium: premium },
    }),
    prisma.subscription.upsert({
      where: { userId: user.id },
      create: { stripeSubscriptionId: subscription.id, userId: user.id, ...data },
      update: { stripeSubscriptionId: subscription.id, ...data },
    }),
  ]);
}

// Rend l'abonnement actif d'un client, s'il en a un. Stripe fait foi: c'est
// chez lui que l'argent a change de main.
export async function abonnementActifChezStripe(
  stripeCustomerId: string,
): Promise<Stripe.Subscription | null> {
  const abonnements = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 100,
  });

  return abonnements.data.find((a) => grantsPremium(a.status)) ?? null;
}

// Rattrape un webhook manque.
//
// Le webhook est le chemin normal, mais il n'est PAS garanti: il peut n'y avoir
// aucun endpoint configure, la signature peut ne pas correspondre, le
// deploiement peut etre injoignable. Quand ca arrive, le client a paye et
// n'a rien -- ce qui est le pire etat possible.
//
// La page de retour de paiement est le seul moment ou l'on sait qu'un paiement
// vient d'avoir lieu ET ou l'utilisateur est devant nous. On en profite pour
// verifier chez Stripe plutot que de le croire sur parole.
//
// Idempotent: si le webhook a deja fait le travail, l'upsert reecrit la meme
// chose. Rien a coordonner entre les deux chemins.
export async function reconcilierAvecStripe(
  stripeCustomerId: string | null,
): Promise<boolean> {
  if (!stripeCustomerId) return false;

  try {
    const abonnement = await abonnementActifChezStripe(stripeCustomerId);

    if (!abonnement) return false;

    await syncSubscription(abonnement);
    return true;
  } catch (error) {
    // Un echec de reconciliation ne doit pas casser la page: on rend l'etat
    // "pas encore confirme", qui est vrai, et l'utilisateur peut recharger.
    console.error("Reconciliation Stripe impossible :", error);
    return false;
  }
}
