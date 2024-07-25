import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUser } from "@/lib/actionsUsers";
import Image from "next/image";
import PremiumBadge from "../src/icons/PremiumBadge.svg";

export default function PagePayment() {
  const itemsPremium = [
    { name: "Notes illimitées" },
    { name: "Intégration de l'intelligence artificielle" },
    { name: "Support Technique et Mises à jour" },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-4 mt-3">
      <Card className="flex flex-col">
        <CardContent className="py-8">
          <div>
            <h3 className="text-md font-black uppercase bg-purple-800 bg-opacity-20 text-purple-500 p-3 rounded-md inline">
              Pass Premium
            </h3>
          </div>
          <div className="mt-4 text-6xl font-black">
            <span>19,99 €</span>
            <span className="text-sm text-muted-foreground">/ par mois</span>
          </div>
          <p className="mt-4 text-muted-foreground">
            Débloquer un nouveau niveau de productivité personnelle 💥
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
