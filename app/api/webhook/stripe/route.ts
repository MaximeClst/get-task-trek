import { syncSubscription } from "@/lib/abonnement";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { Stripe } from "stripe";

// syncSubscription vit dans lib/abonnement.ts, pas ici: la page de retour de
// paiement s'en sert aussi pour rattraper un webhook manque. Et un route.ts
// n'exporte que des methodes HTTP.

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
