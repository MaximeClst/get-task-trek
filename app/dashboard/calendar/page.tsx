import { requirePremium } from "@/lib/session";
import CalendarComponent from "./CalendarComponent";

// Server Component: requirePremium() relit isPremium en base et redirige un
// compte gratuit vers /dashboard/payment AVANT tout rendu. L'ancienne version
// etait "use client" et redirigeait dans un useEffect -- contournable, le
// composant se montait quand meme.
export default async function CalendarPage() {
  await requirePremium();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Mon Calendrier</h1>
      <CalendarComponent />
    </div>
  );
}
