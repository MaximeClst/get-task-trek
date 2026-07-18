import { requirePremium } from "@/lib/session";
import ChatWindow from "./ChatWindow";

// Server Component: la page n'avait AUCUN controle, un compte gratuit y accedait
// en tapant l'URL. requirePremium() relit isPremium en base et redirige avant
// de rendre l'assistant.
export default async function Chat() {
  await requirePremium();

  return (
    <div className="flex flex-col w-full max-w-md py-2 mx-auto stretch">
      <ChatWindow />
    </div>
  );
}
