import { Button } from "@/app/src/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/src/components/ui/card";
import { PRIX_PREMIUM } from "@/lib/offres";
import { Sparkles } from "lucide-react";
import Link from "next/link";

// L'offre en cours n'apparaissait NULLE PART dans l'application: pour savoir
// s'il payait, l'utilisateur devait ouvrir la page de tarifs et deduire de
// l'etat des boutons. C'est la premiere question qu'on se pose dans des
// reglages.
//
// Presentation pure: `premium` arrive en prop. C'est la page qui le resout via
// getUser(), donc en BASE -- jamais depuis la session, qui annoncerait encore
// Premium apres une resiliation.
export default function EncartAbonnement({ premium }: { premium: boolean }) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Abonnement
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
              premium
                ? "bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {premium ? "Premium" : "Gratuit"}
          </span>
        </CardTitle>
        <CardDescription>
          {premium
            ? `Treky classe et catégorise vos dictées. ${PRIX_PREMIUM} par mois, résiliable à tout moment.`
            : "Vous classez vos notes vous-même, et vous êtes limité à 10 notes."}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        {/* Un lien, pas un formulaire: ouvrir le portail Stripe ou le tunnel de
            paiement se fait depuis la page de tarifs, qui porte deja les deux
            boutons et leur etat d'attente. */}
        <Link href="/dashboard/payment">
          <Button variant={premium ? "outline" : "default"}>
            {premium ? (
              "Gérer mon abonnement"
            ) : (
              <>
                <Sparkles className="mr-2 w-4" />
                Découvrir Premium
              </>
            )}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
