import SubmitButton from "@/app/components/SubmitButton";
import { Button } from "@/app/src/components/ui/button";
import { createCustomerPortal, createSubscription } from "@/lib/actionsStripe";
import {
  OFFRE_FREE,
  OFFRE_PREMIUM,
  PRIX_PREMIUM,
  type Avantage,
} from "@/lib/offres";
import { Check } from "lucide-react";

// Presentation pure: l'etat d'abonnement arrive en PROP, il n'est pas lu ici.
// C'est la page qui le resout via getUser(), donc en base. Ce composant ne
// decide de rien -- il ne fait qu'afficher, ce qui le rend regardable hors
// authentification.
export default function CartesOffres({ premium }: { premium: boolean }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 md:items-start">
      {/* --- Gratuit --- */}
      <div className="rounded-xl bg-muted/60 p-8 ring-1 ring-border">
        <h3 className="text-lg font-semibold">{OFFRE_FREE.nom}</h3>

        <p className="mt-4 text-5xl font-black tracking-tight">0 €</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {OFFRE_FREE.resume}
        </p>

        <div className="mt-6">
          <Button
            variant={premium ? "outline" : "secondary"}
            disabled
            className="w-full"
          >
            {premium ? "Inclus dans Premium" : "Offre actuelle"}
          </Button>
        </div>

        <ListeAvantages avantages={OFFRE_FREE.avantages} />
      </div>

      {/* --- Premium --- */}
      {/* La carte Premium doit se DETACHER. En clair, un pave sombre suffit.
          En sombre, ce meme pave se noyait dans le fond de page (verifie a
          l'ecran): on l'eclaircit d'un cran et on ajoute un lisere accent. */}
      <div className="rounded-xl bg-zinc-900 p-8 text-zinc-50 ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-cyan-400/30">
        <h3 className="text-lg font-semibold">{OFFRE_PREMIUM.nom}</h3>

        <p className="mt-4 text-5xl font-black tracking-tight">
          {PRIX_PREMIUM}
          <span className="text-base font-medium text-zinc-400">/mois</span>
        </p>
        <p className="mt-2 text-sm text-zinc-400">{OFFRE_PREMIUM.resume}</p>

        <div className="mt-6">
          {premium ? (
            // Le portail Stripe est le seul endroit ou l'on resilie ou change
            // de moyen de paiement: on ne reimplemente pas ca chez nous.
            <form action={createCustomerPortal}>
              <SubmitButton
                className="w-full bg-zinc-50 text-zinc-900 hover:bg-zinc-200"
                pendingLabel="Ouverture…"
              >
                Gérer mon abonnement
              </SubmitButton>
            </form>
          ) : (
            <form action={createSubscription}>
              <SubmitButton
                className="w-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white"
                pendingLabel="Redirection…"
              >
                Passer à Premium
              </SubmitButton>
            </form>
          )}
        </div>

        <ListeAvantages avantages={OFFRE_PREMIUM.avantages} sombre />

        {premium && (
          <p className="mt-6 text-xs text-zinc-400">
            Vous êtes abonné. La résiliation prend effet à la fin de la période
            déjà payée.
          </p>
        )}
      </div>
    </div>
  );
}

function ListeAvantages({
  avantages,
  sombre = false,
}: {
  avantages: Avantage[];
  sombre?: boolean;
}) {
  return (
    <ul className="mt-8 space-y-3 text-sm">
      {avantages.map((avantage) => (
        <li key={avantage.texte} className="flex items-start gap-3">
          <Check
            className={`mt-0.5 w-4 shrink-0 ${
              sombre ? "text-cyan-400" : "text-foreground"
            }`}
            aria-hidden
          />
          <span className={sombre ? "text-zinc-200" : ""}>
            {avantage.texte}
            {/* Annoncer une date de livraison qu'on ne tient pas serait pire
                que se taire: on dit "bientot", sans promettre de mois. */}
            {avantage.bientot && (
              <span
                className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  sombre
                    ? "bg-zinc-700 text-zinc-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Bientôt
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
