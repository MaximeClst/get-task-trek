"use client";

import { Button } from "@/app/src/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function ButtonSignOut() {
  const router = useRouter();

  const handleSignOut = () => {
    signOut();
    router.push("/");
  };

  return (
    <div className="flex items-center justify-end mb-2 lg:mt-0 p-3">
      <Button
        onClick={handleSignOut}
        className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white"
      >
        <LogOut />
      </Button>
    </div>
  );
}
