import { Button } from "@/app/src/components/ui/button";
import { Card, CardContent } from "@/app/src/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import TaskLogo from "../app/src/icons/TaskLogo.svg";
import CartesOffres from "./components/CartesOffres";
import HeroTitle from "./components/HeroTitle";

const features = [
  {
    emoji: "🎙️",
    title: "Dictez",
    body: "Parlez, Task Trek transcrit. Une note, une tâche, un rendez-vous : peu importe, dites-le comme ça vient.",
  },
  {
    emoji: "✨",
    title: "L'IA trie",
    body: "Elle reconnaît ce que vous avez dicté, le classe en note, tâche ou rendez-vous, et le range dans la bonne catégorie.",
  },
  {
    emoji: "📅",
    title: "Ça atterrit au bon endroit",
    body: "Les rendez-vous partent dans votre Google Agenda. Les tâches vous reviennent par e-mail avant l'échéance.",
  },
];

// Les listes de fonctionnalites vivaient ICI, en double de celles du tableau de
// bord. Elles avaient deja diverge: la landing promettait les rendez-vous
// ajoutes tout seuls et les rappels e-mail sans reserve, alors que ni l'un ni
// l'autre n'est livre. Une seule source desormais: lib/offres.ts, via
// CartesOffres.

export default function Home() {
  return (
    <main className="max-w-[1200px] mx-auto px-5">
      <section className="flex flex-col items-center justify-center gap-2 py-20 text-center">
        <Image
          width={100}
          height={100}
          src={TaskLogo}
          alt="Logo de Task Trek"
          className="mb-4 object-contain"
        />
        <HeroTitle />
        <p className="my-2 text-lg text-muted-foreground max-w-xl">
          Dictez vos notes, vos tâches et vos rendez-vous. Task Trek les écrit,
          les classe et les range à votre place.
        </p>
        <div className="flex items-center gap-3 mt-6">
          <Link href="/login">
            <Button className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white">
              Commencer gratuitement
            </Button>
          </Link>
          <Link href="#pricing">
            <Button variant="secondary">Voir les tarifs</Button>
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Gratuit, sans carte bancaire.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3 pb-20">
        {features.map((feature) => (
          <Card key={feature.title} className="h-full">
            <CardContent className="py-8">
              <span className="text-3xl">{feature.emoji}</span>
              <h2 className="mt-4 text-xl font-black uppercase">
                {feature.title}
              </h2>
              <p className="mt-2 text-muted-foreground">{feature.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section id="pricing" className="pb-20 scroll-mt-8">
        <div className="mx-auto mb-8 max-w-screen-md text-center lg:mb-12">
          <h2 className="mb-4 text-4xl font-extrabold tracking-tight">
            Un prix, tout compris
          </h2>
          <p className="font-light text-muted-foreground sm:text-xl">
            Commencez gratuitement. Passez au Premium quand vous en avez assez
            de trier vous-même.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <CartesOffres etat="publique" />
        </div>
      </section>
    </main>
  );
}
