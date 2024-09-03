import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { Stripe } from "stripe";

export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const signature = headers().get("Stripe-signature") as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (error: unknown) {
    console.error("Error verifying Stripe webhook:", error);
    return new Response("Invalid Stripe webhook signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice
        );
        break;

      default:
        console.warn(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error("Error processing webhook event:", error);
    return new Response("Webhook processing error", { status: 500 });
  }

  return new Response(null, { status: 200 });
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const subscriptionId = session.subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: session.customer as string },
  });

  if (!user) {
    throw new Error("User not found for customerId: " + session.customer);
  }

  await prisma.subscription.create({
    data: {
      stripeSubscriptionId: subscription.id,
      userId: user.id,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      status: subscription.status,
      planId: subscription.items.data[0].plan.id,
      interval: String(subscription.items.data[0].plan.interval),
    },
  });
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      planId: subscription.items.data[0].plan.id,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      status: subscription.status,
    },
  });
}
