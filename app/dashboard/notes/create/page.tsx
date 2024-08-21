"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createNote } from "@/lib/actionsNotes";
import Link from "next/link";
import { useState } from "react";

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await createNote(new FormData(e.currentTarget as HTMLFormElement));
      setTitle("");
      setDescription("");
      // Redirection ou message de succès ici
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Nouvelle note</CardTitle>
          <CardDescription>Quelques mots pour ne pas oublier</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-5">
          <div className="gap-y-2 flex flex-col">
            <Label htmlFor="title">Titre</Label>
            <Input
              type="text"
              name="title"
              id="title"
              required
              placeholder="Titre de la note"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="gap-y-2 flex flex-col">
            <Label htmlFor="description">Description</Label>
            <Textarea
              name="description"
              id="description"
              required
              placeholder="...🖋️"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <Button
            type="button"
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            <Link href="/dashboard/notes">Annuler</Link>
          </Button>
          <Button
            type="submit"
            className="bg-purple-400 hover:bg-purple-500 text-white"
          >
            Créer une note
          </Button>
        </CardFooter>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </form>
    </Card>
  );
}
