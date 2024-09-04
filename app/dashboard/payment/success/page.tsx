import { buttonVariants } from "@/app/src/components/ui/button";
import { Card } from "@/app/src/components/ui/card";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";

export default function SuccessPage() {
  return (
    <section className="w-full h-screen pt-20 text-center">
      <Card className="w-[400px] mx-auto p-4">
        <BadgeCheck className="mb-3 text-8xl text-center text-green-500 w-full" />
        <h1 className="text-xl font-black mb-2 text-center uppercase">
          Paiment réussi
        </h1>
        <p className="text-muted-foreground text-sm mb-2">
          Bravo ! Vous êtes maintenant membre premium
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            className={buttonVariants({ size: "sm", variant: "secondary" })}
            href="/dashboard/notes"
          >
            Go to Note
          </Link>
          <Link
            className={buttonVariants({ size: "sm" })}
            href="/dashboard/assistant"
          >
            Go to Ai Assistant
          </Link>
        </div>
      </Card>
    </section>
  );
}
