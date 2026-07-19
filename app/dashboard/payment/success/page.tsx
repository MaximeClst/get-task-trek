import { buttonVariants } from "@/app/src/components/ui/button";
import { Card } from "@/app/src/components/ui/card";
import { reconcilierAvecStripe } from "@/lib/abonnement";
import { getUser } from "@/lib/session";
import { BadgeCheck, Clock } from "lucide-react";
import Link from "next/link";

// Cette page annoncait "Vous etes maintenant membre premium" sans rien
// verifier: du texte statique, affiche du seul fait d'etre arrive sur l'URL.
// Elle a menti a un utilisateur qui avait bien paye mais dont le webhook
// n'etait jamais arrive -- il se voyait feliciter tout en restant en gratuit.
//
// C'est la meme regle que pour les boutons (CLAUDE.md): ne jamais afficher un
// succes avant d'avoir le resultat. On interroge donc Stripe, qui fait foi,
// et on rattrape au passage le webhook manque.
export default async function SuccessPage() {
  const user = await getUser();
  const premium = await reconcilierAvecStripe(user.stripeCustomerId);

  if (!premium) {
    return (
      <section className="w-full pt-20 text-center">
        <Card className="mx-auto w-[400px] p-6">
          <Clock className="mb-3 w-full text-center text-6xl text-amber-500" />
          <h1 className="mb-2 text-center text-xl font-black uppercase">
            Paiement en cours de confirmation
          </h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Votre paiement a bien été transmis, mais nous n&apos;avons pas
            encore la confirmation de notre prestataire. Cela prend
            généralement quelques secondes. Rechargez cette page.
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            Si rien ne change d&apos;ici quelques minutes, écrivez-nous : aucun
            paiement n&apos;est perdu.
          </p>
          <Link
            className={buttonVariants({ size: "sm", variant: "secondary" })}
            href="/dashboard/payment/success"
          >
            Recharger
          </Link>
        </Card>
      </section>
    );
  }

  return (
    <section className="w-full pt-20 text-center">
      <Card className="mx-auto w-[400px] p-6">
        <BadgeCheck className="mb-3 w-full text-center text-6xl text-green-500" />
        <h1 className="mb-2 text-center text-xl font-black uppercase">
          Bienvenue en Premium
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Treky classe et catégorise désormais vos dictées à votre place.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            className={buttonVariants({ size: "sm", variant: "secondary" })}
            href="/dashboard/notes"
          >
            Mes notes
          </Link>
          <Link
            className={buttonVariants({ size: "sm" })}
            href="/dashboard/treky"
          >
            Dicter une note
          </Link>
        </div>
      </Card>
    </section>
  );
}
