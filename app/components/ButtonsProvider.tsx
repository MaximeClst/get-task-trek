"use client";

import { Button } from "@/app/src/components/ui/button";
import { signIn } from "next-auth/react";
import Image from "next/image";
import GoogleIcon from "../src/icons/GoogleIcon.svg";

// callbackUrl est deja filtre cote serveur par la page de connexion.
export default function ButtonsProvider({
  callbackUrl = "/dashboard/notes",
}: {
  callbackUrl?: string;
}) {
  return (
    <div className="flex flex-col space-y-4">
      <Button
        onClick={() => signIn("google", { callbackUrl })}
        variant={"secondary"}
      >
        Continuer avec Google
        <Image
          width={16}
          height={16}
          src={GoogleIcon}
          alt="Logo de Google"
          className="ml-2"
        />
      </Button>
    </div>
  );
}
