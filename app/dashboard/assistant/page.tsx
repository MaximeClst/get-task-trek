import { requirePremium } from "@/lib/session";
import { Mic } from "lucide-react";

// Server Component: requirePremium() relit isPremium en base et redirige un
// compte gratuit avant tout rendu.
//
// L'ancien contenu -- un "chat" qui n'appelait jamais de modele, fait d'un arbre
// de if et de regex -- a ete supprime. Il postait vers /api/create-event et
// /api/calendar, deux routes qui n'ont jamais existe, et son useChat() pointait
// vers /api/chat, supprimee depuis: l'ecran etait casse de bout en bout.
//
// Treky, la vraie boucle de dictee, arrive ici a la PR suivante.
export default async function AssistantPage() {
  await requirePremium();

  return (
    <section className="grid items-start gap-y-4">
      <div className="grid gap-1 px-2">
        <h2 className="text-3xl uppercase font-black">Treky</h2>
        <p className="text-lg text-muted-foreground">
          Dictez, il s&apos;occupe du rangement 🎙️
        </p>
        <div className="w-12 bg-white my-2 mx-1 h-[1px]"></div>
      </div>

      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-md border border-dashed p-6 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center bg-purple-800 bg-opacity-20 mb-4">
          <Mic />
        </div>
        <p className="font-medium">Treky se prépare</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          L&apos;ancien assistant ne parlait à aucun modèle : c&apos;était un
          arbre de conditions branché sur des routes inexistantes. Il a été
          retiré plutôt que rafistolé.
        </p>
      </div>
    </section>
  );
}
