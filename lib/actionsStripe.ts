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

export const createSubscription = async () => {
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

    const subscriptionUrl = await getStripeSession({
      customerId: dbUser.stripeCustomerId,
      domainUrl:
        process.env.NEXT_PUBLIC_DOMAIN_URL ||
        "https://get-task-trek.vercel.app",
      priceId: process.env.STRIPE_API_ID as string,
    });

    if (!subscriptionUrl) {
      throw new Error("Failed to create subscription URL");
    }

    return redirect(subscriptionUrl);
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
};

export const createCustomerPortal = async () => {
  try {
    const user = await getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    });

    if (!dbUser?.stripeCustomerId) {
      throw new Error("User does not have a stripeCustomerId");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
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
