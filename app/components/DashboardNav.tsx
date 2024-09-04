"use client";
import { Bot, CalendarDays, Cog, CreditCard, NotebookPen } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const menuDashboard = [
    { name: "Notes", icon: NotebookPen, path: "/dashboard/notes" },
    { name: "Settings", icon: Cog, path: "/dashboard/settings" },
    { name: "Price", icon: CreditCard, path: "/dashboard/payment" },
  ];
  if (session?.user?.isPremium) {
    menuDashboard.push({
      name: "AI Assistant",
      icon: Bot,
      path: "/dashboard/assistant",
    });
    menuDashboard.push({
      name: "Calendar",
      icon: CalendarDays,
      path: "/dashboard/calendar",
    });
  }

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
    </nav>
  );
}
