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
import { CONTENT_MAX, TITLE_MAX } from "@/lib/validationNotes";
import type { NoteType } from "@prisma/client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

// Les categories sont chargees par la page (Server Component) et passees ici:
// ce composant est "use client", il ne peut pas interroger la base lui-meme
// sans declencher un aller-retour supplementaire apres le montage.
export default function CreateNoteForm({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  // En Free, le classement est MANUEL: c'est l'utilisateur qui choisit. En
  // Premium, l'IA proposera ce type -- mais l'ecran reste le meme.
  const [type, setType] = useState<NoteType>("NOTE");
  const [categoryId, setCategoryId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    // Arriver depuis le calendrier avec une date, c'est vouloir un rendez-vous.
    if (startParam) {
      setStartAt(startParam);
      setType("EVENT");
    }
    if (endParam) setEndAt(endParam);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const data = {
      type,
      title: title,
      content: content,
      // Chaine vide -> undefined: une note sans date ne doit pas envoyer "".
      startAt: startAt || undefined,
      endAt: endAt || undefined,
      categoryId: categoryId || undefined,
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
            <Label htmlFor="type">Type</Label>
            {/* Le classement manuel, c'est ce que fait le tier gratuit. En
                Premium l'IA remplira ce champ a la place de l'utilisateur. */}
            <select
              name="type"
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as NoteType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="NOTE">Note</option>
              <option value="TASK">Tâche</option>
              <option value="EVENT">Rendez-vous</option>
            </select>
          </div>
          <div className="gap-y-2 flex flex-col">
            <Label htmlFor="categoryId">Catégorie</Label>
            <select
              name="categoryId"
              id="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Sans catégorie</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucune catégorie pour l&apos;instant —{" "}
                <Link href="/dashboard/categories" className="underline">
                  créez-en une
                </Link>
                .
              </p>
            )}
          </div>
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
            <Label htmlFor="content">Contenu</Label>
            <Textarea
              name="content"
              id="content"
              maxLength={CONTENT_MAX}
              placeholder="...🖋️"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          {/* Une note simple n'a pas de date: les champs n'apparaissent que
              pour une tache (echeance) ou un rendez-vous. Ils etaient `required`
              pour tout le monde, ce qui obligeait a dater une simple idee. */}
          {type !== "NOTE" && (
            <>
              <div className="gap-y-2 flex flex-col">
                <Label htmlFor="startAt">
                  {type === "TASK" ? "Échéance" : "Date de début"}
                </Label>
                <Input
                  type="datetime-local"
                  name="startAt"
                  id="startAt"
                  required={type === "EVENT"}
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>
              {type === "EVENT" && (
                <div className="gap-y-2 flex flex-col">
                  <Label htmlFor="endAt">Date de fin</Label>
                  <Input
                    type="datetime-local"
                    name="endAt"
                    id="endAt"
                    required
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </div>
              )}
            </>
          )}
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
