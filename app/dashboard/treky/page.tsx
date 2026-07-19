import TrekyRecorder from "@/app/components/TrekyRecorder";
import { getAllCategories } from "@/lib/actionsCategories";
import { lireUsage } from "@/lib/quotaTranscription";
import { getUser } from "@/lib/session";

// PAS de requirePremium() ici, et c'est voulu.
//
// La dictee et la transcription sont ouvertes a TOUS, Free inclus: c'est
// explicitement le seul appel IA du tier gratuit (CLAUDE.md). Ce que le Premium
// automatise, c'est le TRI qui vient apres -- classer et categoriser. L'ecran
// est donc le meme pour les deux offres; seul le remplissage des deux derniers
// champs change.
//
// L'ancienne page /dashboard/assistant etait gardee par requirePremium(), ce qui
// etait juste tant qu'elle contenait un "chat". Elle ne le serait plus ici.
export default async function TrekyPage() {
  const [user, categories] = await Promise.all([getUser(), getAllCategories()]);
  const usage = await lireUsage(user.id, user.isPremium);

  return (
    <section className="grid items-start gap-y-4">
      <div className="grid gap-1 px-2">
        <h2 className="text-3xl uppercase font-black">Treky</h2>
        <p className="text-lg text-muted-foreground">
          Dictez, il s&apos;occupe du rangement 🎙️
        </p>
        <div className="w-12 bg-white my-2 mx-1 h-[1px]"></div>
      </div>

      <TrekyRecorder
        categories={categories.map(({ id, name }) => ({ id, name }))}
        // Sert uniquement a savoir s'il faut LANCER le tri et quoi afficher.
        // L'action de tri revérifie isPremium en base: si ce booleen etait
        // falsifie cote client, l'appel serait refuse.
        isPremium={user.isPremium}
        restantSecondes={usage.restantSecondes}
        quotaSecondes={usage.quotaSecondes}
        renouvelleLe={usage.renouvelleLe.toISOString()}
      />

      {!user.isPremium && (
        <p className="px-2 text-sm text-muted-foreground">
          Vous classez vos notes vous-même. Avec Premium, Treky choisit le type
          et la catégorie à votre place — et vous passez à{" "}
          {Math.round(usage.quotaSecondes / 60)} minutes de dictée par mois à
          10 heures.
        </p>
      )}
    </section>
  );
}
