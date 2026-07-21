"use server";

import { redirect } from "next/navigation";
import { abonnementActifChezStripe } from "./abonnement";
import { getUser } from "./session";
import { prisma } from "./db";
import { getStripeSession, stripe } from "./stripe";
import { enforceRateLimit } from "./rateLimit";

// L'userId n'est PLUS un argument. Cette fonction est exportee d'un fichier
// "use server": c'etait donc un endpoint HTTP public qui rendait le statut
// d'abonnement ET le stripeCustomerId de n'importe quel compte, a qui savait
// deviner un identifiant. C'est la regle 1 du CLAUDE.md, et le genre de faille
// qui a coule la v1. L'utilisateur est resolu ici, en interne.
export const getDataStripeUser = async () => {
  const user = await getUser();

  try {
    return await prisma.subscription.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        status: true,
      },
    });
  } catch (error) {
    console.error("Error fetching Stripe user data:", error);
    throw error;
  }
};

// Un seul plan: Premium mensuel. Le priceId est resolu ici, cote serveur, et
// n'est jamais accepte depuis le client (qui choisirait alors son tarif).
export const createSubscription = async () => {
  let subscriptionUrl: string;

  try {
    const user = await getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Avant tout appel a Stripe: cette action en declenche deux (retrieve du
    // prix, puis creation de la session). Les marteler coute des appels API
    // facturables et peut nous faire limiter par Stripe lui-meme.
    await enforceRateLimit("createSubscription", user.id);

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

    // Stripe n'empeche PAS de souscrire deux fois au meme prix: rien, chez lui,
    // ne dit qu'un client ne peut avoir qu'un abonnement. Sans ce garde, un
    // utilisateur dont l'acces n'a pas ete active -- webhook manque, par
    // exemple -- repaie en croyant que ca n'a pas marche, et se retrouve
    // preleve deux fois. C'est arrive.
    //
    // On interroge Stripe et non notre base: c'est justement quand notre base
    // est desynchronisee que ce garde sert a quelque chose.
    const dejaAbonne = await abonnementActifChezStripe(dbUser.stripeCustomerId);
    if (dejaAbonne) {
      throw new Error(
        "Vous avez déjà un abonnement actif. Rechargez la page ; si le problème persiste, ouvrez la gestion de votre abonnement.",
      );
    }

    const priceId = process.env.STRIPE_PRICE_ID_MONTHLY;
    if (!priceId) {
      throw new Error("STRIPE_PRICE_ID_MONTHLY n'est pas configure.");
    }

    // Vérification du statut du `priceId`
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) {
      throw new Error(`The price specified (${priceId}) is inactive.`);
    }

    // La session est creee en mode "subscription", que Stripe refuse pour un
    // prix one-time. Echouer ici donne un message clair, plutot qu'une erreur
    // Stripe opaque au moment de payer.
    if (!price.recurring) {
      throw new Error(
        `Le prix ${priceId} n'est pas recurrent (type "${price.type}") et ne peut pas servir a un abonnement.`,
      );
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
