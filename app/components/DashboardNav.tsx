"use client";
import {
  CalendarDays,
  Cog,
  CreditCard,
  Mic,
  NotebookPen,
  Tags,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// isPremium arrive du layout, qui le tient de getUser() -- donc de la BASE.
// Auparavant ce composant le lisait via useSession(), c'est-a-dire depuis le
// client: la valeur restait celle du cookie tant que la session n'etait pas
// rafraichie, et les onglets pouvaient rester masques apres un paiement.
// Le layout appelle deja getUser(), qui est enveloppe dans cache(): passer la
// valeur en prop ne coute aucun aller-retour supplementaire.
//
// A noter: ce n'est toujours que du confort d'affichage. Le controle d'acces
// reel est requirePremium() sur /dashboard/calendar.
export default function DashboardNav({ isPremium }: { isPremium: boolean }) {
  const pathname = usePathname();

  const menuDashboard = [
    // Treky (dictee) est ouvert a TOUS: la transcription est le seul appel IA
    // du tier gratuit. Seul le calendrier reste derriere le Premium.
    { name: "Treky", icon: Mic, path: "/dashboard/treky" },
    { name: "Notes", icon: NotebookPen, path: "/dashboard/notes" },
    // Les categories sont manuelles en Free: le lien n'est pas conditionne au
    // Premium non plus.
    { name: "Catégories", icon: Tags, path: "/dashboard/categories" },
    { name: "Settings", icon: Cog, path: "/dashboard/settings" },
    { name: "Price", icon: CreditCard, path: "/dashboard/payment" },
  ];

  return (
    <nav className="flex md:flex-col md:h-full md:w-16 w-full lg:w-40 gap-2">
      {menuDashboard.map((link, index) => {
        const isActive = pathname.startsWith(link.path);
        return (
          <Link href={link.path} key={index}>
            <div
              className={`flex items-center justify-center lg:justify-start gap-2 cursor-pointer lg:p-3 p-2 hover:bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:bg-opacity-50 hover:text-white text-sm font-bold rounded-md ${
                isActive &&
                "bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white"
              }`}
            >
              <link.icon className="w-4" />
              <span className="hidden lg:block">{link.name}</span>
            </div>
          </Link>
        );
      })}

      {/* Confort d'affichage uniquement: on masque les liens Premium aux comptes
          gratuits. Le vrai controle d'acces est cote serveur (requirePremium sur
          la page /dashboard/calendar).
          Treky n'est plus ici: la dictee est ouverte a tous. */}
      <div
        className={`${
          isPremium ? "flex" : "hidden"
        } md:flex-col md:h-full md:w-16 w-full lg:w-40 gap-2`}
      >
        <Link href="/dashboard/calendar">
          <div
            className={`flex items-center justify-center lg:justify-start gap-2 cursor-pointer lg:p-3 p-2 hover:bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:bg-opacity-50 hover:text-white text-sm font-bold rounded-md ${
              pathname.startsWith("/dashboard/calendar") &&
              "bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white"
            }`}
          >
            <CalendarDays className="w-4" />
            <span className="hidden lg:block">Calendar</span>
          </div>
        </Link>
      </div>
    </nav>
  );
}
