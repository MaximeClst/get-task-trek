"use client";

import { Button } from "@/app/src/components/ui/button";
import { deleteNote } from "@/lib/actionsNotes";
import { Loader2, Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { toast } from "react-toastify";

interface DeleteButtonProps {
  id: string;
}

// useFormStatus doit vivre dans un enfant du <form> pour en lire l'etat.
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? "Suppression en cours" : "Supprimer la note"}
      className="bg-red-500 hover:bg-red-600 text-white disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="w-4 animate-spin" />
      ) : (
        <Trash2 className="w-4" />
      )}
    </Button>
  );
}

export default function ButtonDelete({ id }: DeleteButtonProps) {
  // Le toast de succes etait branche sur onClick du <form>: il s'affichait au
  // clic, avant meme que l'action parte, et annoncait un succes meme quand la
  // suppression echouait. Il attend desormais le resultat reel.
  const handleAction = async (formData: FormData) => {
    try {
      await deleteNote(formData);
      toast.success("Note supprimée.", { autoClose: 1500 });
    } catch {
      toast.error("Suppression impossible.", { autoClose: 2500 });
    }
  };

  return (
    <form action={handleAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton />
    </form>
  );
}
