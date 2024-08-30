"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React from "react";
import ChatWindow from "./components/ChatWindow";

export default function AssistantPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "loading") return;
    if (!session) router.push("/auth/login");
    // if (session && !session.user.isPremium) router.push("/dashboard/payment");
  }, [session, status, router]);

  if (status === "loading") {
    return <div>Chargement...</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      <ChatWindow />
    </div>
  );
}
