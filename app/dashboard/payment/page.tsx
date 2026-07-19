import CartesOffres from "@/app/components/CartesOffres";
import { getUser } from "@/lib/session";

// isPremium vient de getUser(), donc de la BASE. C'est la meme valeur qui garde
// les pages Premium: l'ecran ne peut pas afficher "offre actuelle : Premium" a
// un compte qui n'y a en realite plus droit.
export default async function PagePayment() {
  const user = await getUser();

  return (
    <section className="mx-auto w-full max-w-4xl px-2 py-6">
      <div className="mb-10 text-center">
        <h2 className="text-4xl font-black tracking-tight">Nos offres</h2>
        <p className="mt-3 text-muted-foreground">
          La dictée est gratuite. Ce que Premium automatise, c&apos;est le
          rangement.
        </p>
      </div>

      <CartesOffres etat={user.isPremium ? "premium" : "gratuit"} />

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Paiement géré par Stripe. Résiliable à tout moment, sans engagement.
      </p>
    </section>
  );
}
