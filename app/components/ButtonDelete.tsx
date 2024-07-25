"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteNote } from "@/lib/actionsNotes";
import { Trash2 } from "lucide-react";
import { toast } from "react-toastify";

interface DeleteButtonProps {
  id: string;
}

export default function ButtonDelete({ id }: DeleteButtonProps) {
  const handleSubmit = () => {
    toast.success("Note supprimée avec succès.", {
      autoClose: 1500,
    });
  };
  return (
    <form action={deleteNote} onClick={handleSubmit}>
      <Input type="hidden" name="id" value={id} />
      <Button type="submit" className="bg-red-500 hover:bg-red-600 text-white">
        <Trash2 className="w-4" />
      </Button>
    </form>
  );
}
