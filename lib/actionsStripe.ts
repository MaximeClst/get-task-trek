"use server";

import { redirect } from "next/navigation";
import { getUser } from "./actionsUsers";
import { prisma } from "./db";
import { stripe } from "./stripe";

export const getDataStripeUser = async (userId: string) => {
  try {
    const data = await prisma.subscription.findUnique({
      where: {
        userId: userId,
      },
      select: {
        status: true,
        user: {
          select: {
            stripeCustomerId: true,
          },
        },
      },
    });

    if (!data) {
      console.warn(`No subscription data found for userId: ${userId}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error fetching Stripe user data:", error);
    throw error;
  }
};

export type BillingInterval = "monthly" | "yearly";

// Le client ne choisit qu'un intervalle, jamais un priceId : un priceId venant
// du navigateur permettrait de s'abonner au tarif de son choix.
const priceIdFor = (interval: BillingInterval) => {
  const priceId =
    interval === "yearly"
      ? process.env.STRIPE_PRICE_ID_YEARLY
      : process.env.STRIPE_PRICE_ID_MONTHLY;

  if (!priceId) {
    throw new Error(
      `Aucun prix Stripe configuré pour l'intervalle "${interval}".`,
    );
  }

  return priceId;
};

export const createSubscription = async (interval: BillingInterval) => {
  if (interval !== "monthly" && interval !== "yearly") {
    throw new Error(`Intervalle de facturation invalide : "${interval}".`);
  }

  let subscriptionUrl: string;

  try {
    const user = await getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        stripeCustomerId: true,
      },
    });

    if (!dbUser?.stripeCustomerId) {
      throw new Error("User does not have a stripeCustomerId");
    }

    const priceId = priceIdFor(interval);

    // Vérification du statut du `priceId`
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) {
      throw new Error(`The price specified (${priceId}) is inactive.`);
    }

    const url = await getStripeSession({
      customerId: dbUser.stripeCustomerId,
      domainUrl:
        process.env.NEXT_PUBLIC_DOMAIN_URL ||
        "https://get-task-trek.vercel.app",
      priceId: priceId,
    });

    if (!url) {
      throw new Error("Failed to create subscription session.");
    }

    subscriptionUrl = url;
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }

  // redirect() lève NEXT_REDIRECT : le garder hors du try/catch, sinon il est
  // capturé et journalisé comme une erreur alors que tout s'est bien passé.
  redirect(subscriptionUrl);
};

export const createCustomerPortal = async () => {
  try {
    const user = await getUser();

    if (!user?.stripeCustomerId) {
      throw new Error("User does not have a stripeCustomerId");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId as string,
      return_url: process.env.NEXT_PUBLIC_DOMAIN_URL + "/dashboard/payment",
    });

    return redirect(session.url);
  } catch (error) {
    console.error("Error creating customer portal:", error);
    throw error;
  }
};

const getStripeSession = async ({
  priceId,
  domainUrl,
  customerId,
}: {
  priceId: string;
  domainUrl: string;
  customerId: string;
}) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      customer: customerId,
      success_url: `${domainUrl}/dashboard/payment/success`,
      cancel_url: `${domainUrl}/dashboard/payment/cancel`,
    });

    return session.url;
  } catch (error) {
    console.error("Erreur lors de la création de la session Stripe :", error);
    throw error;
  }
};
