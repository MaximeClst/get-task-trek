"use client";

import { Button } from "@/app/src/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

// useFormStatus doit vivre dans un ENFANT du <form> pour en lire l'etat. C'est
// ce qui permet a une page rendue cote serveur d'avoir malgre tout un bouton
// qui montre son attente -- exigence du CLAUDE.md: sans ca, rien ne bouge a
// l'ecran, l'utilisateur reclique et cree des doublons.
export default function SubmitButton({
  children,
  className,
  pendingLabel = "Enregistrement…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <>
          <Loader2 className="w-4 animate-spin mr-2" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
