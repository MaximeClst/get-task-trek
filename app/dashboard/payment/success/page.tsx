import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

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
        <Button className="w-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white">
          <Link href="/dashboard/payment">Retour vers le dashboard</Link>
        </Button>
      </Card>
    </section>
  );
}
