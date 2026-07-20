import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_KEY_SECRET as string, {
  typescript: true,
});

// Seule version de cette fonction. Il en a existe deux -- une exportee ici que
// personne n'importait, une privee dans actionsStripe.ts qui faisait le travail
// -- et elles ne creaient deja plus la meme session. Deux definitions d'un appel
// facturable qui divergent en silence, c'est le genre d'ecart qu'on ne voit
// qu'en production.
//
// Le mode "subscription" est impose ici: c'est le seul usage, et Stripe le
// refuse pour un prix one-time (verifie en amont dans createSubscription).
//
// Retourne `string | null`, comme Stripe: `session.url` peut etre null, et le
// caster en `string` ne ferait que deplacer l'erreur plus loin. L'appelant
// verifie.
export const getStripeSession = async ({
  priceId,
  domainUrl,
  customerId,
}: {
  priceId: string;
  domainUrl: string;
  customerId: string;
}): Promise<string | null> => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    customer: customerId,
    success_url: `${domainUrl}/dashboard/payment/success`,
    cancel_url: `${domainUrl}/dashboard/payment/cancel`,
  });

  return session.url;
};
