"use client";

import { Button } from "@/app/src/components/ui/button";
import { Input } from "@/app/src/components/ui/input";
import { Label } from "@/app/src/components/ui/label";
import { createCategory } from "@/lib/actionsCategories";
import {
  CATEGORY_COLORS,
  CATEGORY_NAME_MAX,
} from "@/lib/validationCategories";
import { Loader2, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "react-toastify";

// useFormStatus doit vivre dans un ENFANT du <form> pour en lire l'etat.
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="w-4 animate-spin" />
      ) : (
        <>
          <Plus className="w-4 mr-1" />
          Créer
        </>
      )}
    </Button>
  );
}

export default function CategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0]);

  // Le toast n'annonce un succes qu'APRES le retour de l'action. Le formulaire
  // n'est vide que dans ce cas: en cas d'echec, la saisie reste a l'ecran.
  const handleAction = async (formData: FormData) => {
    try {
      await createCategory(formData);
      toast.success("Catégorie créée.", { autoClose: 1500 });
      formRef.current?.reset();
      setColor(CATEGORY_COLORS[0]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Création impossible.",
        { autoClose: 3000 }
      );
    }
  };

  return (
    <form
      ref={formRef}
      action={handleAction}
      className="flex flex-col gap-3 rounded-md border p-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nouvelle catégorie</Label>
        <Input
          type="text"
          name="name"
          id="name"
          required
          maxLength={CATEGORY_NAME_MAX}
          placeholder="Courses, Travail, Santé…"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Couleur</Label>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Choisir la couleur ${c}`}
              aria-pressed={color === c}
              className={`h-7 w-7 rounded-full border-2 transition ${
                color === c ? "border-foreground scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
