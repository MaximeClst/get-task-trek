"use client";

import { Button } from "@/app/src/components/ui/button";
import { Input } from "@/app/src/components/ui/input";
import { deleteCategory, updateCategory } from "@/lib/actionsCategories";
import {
  CATEGORY_COLORS,
  CATEGORY_NAME_MAX,
} from "@/lib/validationCategories";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "react-toastify";

type Props = {
  id: string;
  name: string;
  color: string;
  noteCount: number;
};

function PendingButton({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      aria-label={label}
      className={className}
    >
      {pending ? <Loader2 className="w-4 animate-spin" /> : children}
    </Button>
  );
}

export default function CategoryItem({ id, name, color, noteCount }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftColor, setDraftColor] = useState(color);

  const handleUpdate = async (formData: FormData) => {
    try {
      await updateCategory(formData);
      toast.success("Catégorie modifiée.", { autoClose: 1500 });
      setIsEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Modification impossible.",
        { autoClose: 3000 }
      );
    }
  };

  const handleDelete = async (formData: FormData) => {
    try {
      await deleteCategory(formData);
      toast.success("Catégorie supprimée.", { autoClose: 1500 });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible.",
        { autoClose: 3000 }
      );
    }
  };

  if (isEditing) {
    return (
      <form
        action={handleUpdate}
        className="flex flex-wrap items-center gap-2 rounded-md border p-3"
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="color" value={draftColor} />

        <Input
          name="name"
          defaultValue={name}
          required
          maxLength={CATEGORY_NAME_MAX}
          className="w-40"
        />

        <div className="flex flex-wrap gap-1">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDraftColor(c)}
              aria-label={`Choisir la couleur ${c}`}
              aria-pressed={draftColor === c}
              className={`h-6 w-6 rounded-full border-2 ${
                draftColor === c ? "border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <PendingButton label="Enregistrer">
            <Check className="w-4" />
          </PendingButton>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setDraftColor(color);
              setIsEditing(false);
            }}
            aria-label="Annuler"
          >
            <X className="w-4" />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <span
        className="h-4 w-4 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="font-medium">{name}</span>
      <span className="text-xs text-muted-foreground">
        {noteCount === 0
          ? "aucune note"
          : `${noteCount} note${noteCount > 1 ? "s" : ""}`}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setIsEditing(true)}
          aria-label={`Modifier ${name}`}
        >
          <Pencil className="w-4" />
        </Button>

        {/* Supprimer une categorie ne supprime PAS les notes: la relation est
            en onDelete SetNull, elles repassent en "sans categorie". D'ou le
            libelle, qui evite de faire croire a une perte de donnees. */}
        <form action={handleDelete}>
          <input type="hidden" name="id" value={id} />
          <PendingButton
            label={`Supprimer ${name}`}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            <Trash2 className="w-4" />
          </PendingButton>
        </form>
      </div>
    </div>
  );
}
