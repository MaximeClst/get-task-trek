"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React from "react";
import CalendarComponent from "./components/CalendarComponent";

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "loading") return; // Do nothing while loading
    if (!session) router.push("/auth/login"); // Redirect if not authenticated
    if (session && !session.user.isPremium) router.push("/dashboard/payment"); // Redirect if not premium
  }, [session, status, router]);

  if (status === "loading") {
    return <div>Chargement...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Mon Calendrier</h1>
      <CalendarComponent />
    </div>
  );
}
