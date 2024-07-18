"use client";

import Image from "next/image";
import { Cursor, Typewriter } from "react-simple-typewriter";
import TaskLogo from "../app/src/icons/TaskLogo.svg";
import ButtonsProvider from "./components/ButtonsProvider";

export default function Home() {
  return (
    <section className="w-full h-screen flex items-center justify-center flex-col gap-2">
      <Image
        width={100}
        height={100}
        src={TaskLogo}
        alt="Logo de Task Trek"
        className="mb-4 object-contain"
      />
      <h1 className="text-4xl md:text-6xl font-black mb-2 text-center uppercase flex items-center">
        <Typewriter typeSpeed={50} words={["Bienvenue", "Welcome"]} loop={0} />
        <span>
          <Cursor />
        </span>
      </h1>
      <p className="my-2 text-center text-muted-foreground">
        Votre compagnon de notes et tâches, optimisé pour vos besoins.
      </p>
      <ButtonsProvider />
    </section>
  );
}
