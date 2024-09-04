import { buttonVariants } from "@/app/src/components/ui/button";
import { Card } from "@/app/src/components/ui/card";
import { Ban } from "lucide-react";
import Link from "next/link";

export default function CancelPage() {
  return (
    <section className="w-full h-screen pt-20 text-center">
      <Card className="w-[400px] mx-auto p-4">
        <Ban className="mb-3 text-8xl text-center text-red-500 w-full" />
        <h1 className="text-xl font-black mb-2 text-center uppercase">
          Echec paiement
        </h1>
        <p className="text-muted-foreground text-sm mb-2">
          Oups ! Il semble y avoir une erreur
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            className={buttonVariants({ size: "sm", variant: "secondary" })}
            href="/dashboard/payment"
          >
            Retour vers le dashboard
          </Link>
          <Link
            className={buttonVariants({ size: "sm" })}
            href="mailto:contact.maximecslt@gmail.com"
          >
            Contacter le support
          </Link>
        </div>
      </Card>
    </section>
  );
}
