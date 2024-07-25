import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUser } from "@/lib/actionsUsers";
import Image from "next/image";
import PremiumBadge from "../src/icons/PremiumBadge.svg";

export default function PagePayment() {
  const itemsPremium = [
    { name: "Notes Illimitées" },
    { name: "Intégration de l'Intelligence Artificielle" },
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
          <div className="flex-1 flex flex-col justify-between px-6 py-4 bg-secondary rounded-lg m-1 space-t-6 p-3 mt-4">
            <ul className="space-y-3">
              {itemsPremium.map((item, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <span>✅</span>
                  <span>{item.name}</span>
                </li>
              ))}
            </ul>
            <form action="" className="w-full mt-4">
              <Button className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white">
                Devenir membre Premium
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
