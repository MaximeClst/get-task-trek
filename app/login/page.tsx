import ButtonsProvider from "@/app/components/ButtonsProvider";
import { authOptions } from "@/lib/AuthOptions";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Image from "next/image";
import { redirect } from "next/navigation";
import TaskLogo from "../src/icons/TaskLogo.svg";

export const metadata: Metadata = {
  title: "Connexion — Task Trek",
};

const DEFAULT_DESTINATION = "/dashboard/notes";

// Le middleware place la page demandee dans ?callbackUrl. Elle vient de l'URL,
// donc de l'utilisateur: on n'accepte qu'un chemin interne au dashboard.
// Sans ce filtre, /login?callbackUrl=https://exemple.test ferait de la page de
// connexion un tremplin vers un site tiers (open redirect) -- une adresse
// d'apparence legitime qui atterrit ailleurs. Le "//" est refuse explicitement:
// "//exemple.test" est un chemin en apparence, une URL absolue en pratique.
function safeDestination(callbackUrl: string | undefined): string {
  if (!callbackUrl) return DEFAULT_DESTINATION;
  if (!callbackUrl.startsWith("/dashboard")) return DEFAULT_DESTINATION;
  if (callbackUrl.startsWith("//")) return DEFAULT_DESTINATION;
  return callbackUrl;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  // Surtout pas getUser() ici: il redirige vers la connexion quand personne
  // n'est authentifie, ce qui boucle a l'infini sur la page de connexion.
  const session = await getServerSession(authOptions);
  const destination = safeDestination(searchParams.callbackUrl);

  if (session?.user) {
    redirect(destination);
  }

  return (
    <section className="w-full min-h-[80vh] flex items-center justify-center flex-col gap-2 p-4">
      <Image
        width={100}
        height={100}
        src={TaskLogo}
        alt="Logo de Task Trek"
        className="mb-4 object-contain"
      />
      <h1 className="text-3xl md:text-4xl font-black mb-2 text-center uppercase">
        Connexion
      </h1>
      <p className="mb-6 text-center text-muted-foreground max-w-sm">
        Task Trek utilise votre compte Google pour synchroniser vos rendez-vous
        avec votre agenda.
      </p>
      <ButtonsProvider callbackUrl={destination} />
    </section>
  );
}
