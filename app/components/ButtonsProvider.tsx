import { Button } from "@/components/ui/button";
import Image from "next/image";
import GithubIcon from "../src/icons/GithubIcon.svg";
import GoogleIcon from "../src/icons/GoogleIcon.svg";

export default function ButtonsProvider() {
  return (
    <div className="flex flex-col space-y-4">
      <Button variant={"secondary"}>
        Continer avec Google
        <Image
          width={16}
          height={16}
          src={GoogleIcon}
          alt="Logo de Task Trek"
          className="ml-2"
        />
      </Button>
      <Button variant={"secondary"}>
        Continer avec GitHub
        <Image
          width={18}
          height={18}
          src={GithubIcon}
          alt="Logo de Task Trek"
          className="ml-2"
        />
      </Button>
    </div>
  );
}
