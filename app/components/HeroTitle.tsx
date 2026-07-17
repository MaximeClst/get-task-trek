"use client";

import { Cursor, Typewriter } from "react-simple-typewriter";

// Isole react-simple-typewriter (qui a besoin du client) pour que la landing
// reste un Server Component.
export default function HeroTitle() {
  return (
    <h1 className="text-4xl md:text-6xl font-black mb-2 text-center uppercase flex items-center min-h-[1.2em]">
      <Typewriter
        typeSpeed={50}
        words={["Dictez.", "Task Trek range.", "Bienvenue"]}
        loop={0}
      />
      <span>
        <Cursor />
      </span>
    </h1>
  );
}
