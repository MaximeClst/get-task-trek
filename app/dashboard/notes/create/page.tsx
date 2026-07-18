"use client";

import { Button } from "@/app/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/src/components/ui/card";
import { Input } from "@/app/src/components/ui/input";
import { Label } from "@/app/src/components/ui/label";
import { Textarea } from "@/app/src/components/ui/textarea";
import { createNote } from "@/lib/actionsNotes";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/validationNotes";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (startParam) setStart(startParam);
    if (endParam) setEnd(endParam);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const data = {
      title: title,
      description: description,
      start: start,
      end: end,
    };

    // isSubmitting desarme le bouton pendant l'aller-retour: sans lui, rien ne
    // bouge a l'ecran et l'utilisateur reclique, ce qui creait des doublons.
    setIsSubmitting(true);
    try {
      // createNote ne redirige plus (elle est aussi appelee par une route API,
      // ou redirect() cassait la reponse): c'est a l'appelant de le faire.
      await createNote(data);
      router.push("/dashboard/notes");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Création impossible.",
        { autoClose: 3000 },
      );
      setIsSubmitting(false);
    }
    // Pas de setIsSubmitting(false) apres succes: la redirection est en cours,
    // le bouton doit rester desarme jusqu'au changement de page.
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
            {/* maxLength est un confort d'affichage: la limite qui compte est
                celle de createNote, cote serveur. */}
            <Input
              type="text"
              name="title"
              id="title"
              required
              maxLength={TITLE_MAX}
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
              maxLength={DESCRIPTION_MAX}
              placeholder="...🖋️"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="gap-y-2 flex flex-col">
            <Label htmlFor="start">Date de début</Label>
            <Input
              type="datetime-local"
              name="start"
              id="start"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="gap-y-2 flex flex-col">
            <Label htmlFor="end">Date de fin</Label>
            <Input
              type="datetime-local"
              name="end"
              id="end"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
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
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="bg-purple-400 hover:bg-purple-500 text-white disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 mr-2 animate-spin" />
                Création…
              </>
            ) : (
              "Créer une note"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
