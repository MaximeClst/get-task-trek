"use client";

import { Button } from "@/app/src/components/ui/button";
import { signIn } from "next-auth/react";
import Image from "next/image";
import GoogleIcon from "../src/icons/GoogleIcon.svg";

export default function ButtonsProvider() {
  return (
    <div className="flex flex-col space-y-4">
      <Button
        onClick={() => signIn("google", { callbackUrl: "/dashboard/notes" })}
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
