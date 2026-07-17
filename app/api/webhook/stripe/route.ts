import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { Stripe } from "stripe";

// Un abonnement donne acces au premium tant qu'il est actif (ou en essai).
// Tout autre statut (canceled, unpaid, past_due, incomplete...) le coupe.
const grantsPremium = (status: Stripe.Subscription.Status) =>
  status === "active" || status === "trialing";

export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const signature = headers().get("Stripe-signature") as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (error: unknown) {
    console.error("Error verifying Stripe webhook:", error);
    return new Response("Invalid Stripe webhook signature", { status: 400 });
  }

  // Idempotence: Stripe rejoue ses evenements. Si on a deja traite cet event.id,
  // on repond 200 sans rien refaire. On enregistre APRES traitement reussi: si
  // le traitement echoue, l'event n'est pas marque et Stripe pourra le rejouer.
  const seen = await prisma.processedWebhookEvent.findUnique({
    where: { id: event.id },
  });
  if (seen) {
    return new Response(null, { status: 200 });
  }

  try {
    switch (event.type) {
      // Premier paiement: la session ne porte que des identifiants.
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
          await syncSubscription(subscription);
        }
        break;
      }

      // Renouvellement, changement de statut, resiliation: l'objet subscription
      // est fourni directement (ou recuperable), son statut fait foi.
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string,
          );
          await syncSubscription(subscription);
        }
        break;
      }

      default:
        console.warn(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error("Error processing webhook event:", error);
    // 500 sans enregistrer l'event: Stripe rejouera, et le traitement etant
    // idempotent (upsert), le rejeu est sans danger.
    return new Response("Webhook processing error", { status: 500 });
  }

  await prisma.processedWebhookEvent.create({
    data: { id: event.id, type: event.type },
  });

  return new Response(null, { status: 200 });
}

// Aligne l'etat local sur l'abonnement Stripe. Une seule fonction pour tous les
// evenements: elle est idempotente (upsert), donc un rejeu ne casse rien.
async function syncSubscription(
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
