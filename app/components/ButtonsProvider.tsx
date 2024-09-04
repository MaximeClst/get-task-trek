import { Button } from "@/app/src/components/ui/button";
import { signIn } from "next-auth/react";
import Image from "next/image";
import GithubIcon from "../src/icons/GithubIcon.svg";
import GoogleIcon from "../src/icons/GoogleIcon.svg";

export default function ButtonsProvider() {
  return (
    <div className="flex flex-col space-y-4">
      <Button onClick={() => signIn("google")} variant={"secondary"}>
        Continer avec Google
        <Image
          width={16}
          height={16}
          src={GoogleIcon}
          alt="Logo de Google"
          className="ml-2"
        />
      </Button>
      <Button onClick={() => signIn("github")} variant={"secondary"}>
        Continer avec GitHub
        <Image
          width={18}
          height={18}
          src={GithubIcon}
          alt="Logo de Github"
          className="ml-2"
        />
      </Button>
    </div>
  );
}
