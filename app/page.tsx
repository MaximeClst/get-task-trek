import { Button } from "@/app/src/components/ui/button";
import { Card, CardContent } from "@/app/src/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import TaskLogo from "../app/src/icons/TaskLogo.svg";
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

const itemsFree = [
  "Dictée et transcription",
  "Vos catégories, créées à la main",
  "Ajout manuel à Google Agenda",
];

const itemsPremium = [
  "Tout le plan gratuit",
  "Classement automatique par l'IA",
  "Catégorisation automatique",
  "Rendez-vous ajoutés tout seuls",
  "Rappels e-mail sur vos tâches",
];

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

        <div className="flex flex-row justify-center gap-4 max-lg:flex-col max-lg:items-center">
          <Card style={{ width: 300 }} className="h-fit">
            <CardContent className="py-8">
              <h3 className="text-md font-black uppercase bg-purple-800 bg-opacity-20 text-purple-500 p-3 rounded-md inline">
                Starter
              </h3>
              <div className="mt-4 text-6xl font-black">
                <span>Gratuit</span>
              </div>
              <p className="mt-4 text-muted-foreground">
                Pour tester le produit.
              </p>
              <div className="px-6 py-4 bg-secondary rounded-lg m-1 mt-4">
                <ul className="space-y-3">
                  {itemsFree.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span>✅</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="w-full">
                  <Button className="w-full mt-4 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white">
                    Créer mon compte
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card style={{ width: 300 }} className="h-fit">
            <CardContent className="py-8">
              <h3 className="text-md font-black uppercase bg-purple-800 bg-opacity-20 text-purple-500 p-3 rounded-md inline">
                Premium
              </h3>
              <div className="mt-4 text-6xl font-black">
                <span>15,99 €</span>
                <span className="text-sm text-muted-foreground">/mois</span>
              </div>
              <p className="mt-4 text-muted-foreground">
                L'IA s'occupe du tri à votre place.
              </p>
              <div className="px-6 py-4 bg-secondary rounded-lg m-1 mt-4">
                <ul className="space-y-3">
                  {itemsPremium.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span>✅</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="w-full">
                  <Button className="w-full mt-4 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white">
                    Commencer
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

        </div>
      </section>
    </main>
  );
}
