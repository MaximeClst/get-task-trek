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
import { CONTENT_MAX, TITLE_MAX } from "@/lib/validationNotes";
import { Label } from "@/app/src/components/ui/label";
import { Textarea } from "@/app/src/components/ui/textarea";
import { getNote, updateNote } from "@/lib/actionsNotes";
import { getAllCategories } from "@/lib/actionsCategories";
import Link from "next/link";

interface Params {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

interface UpdatePageProps {
  params: Params;
}

export default async function PageNote({ params }: UpdatePageProps) {
  // Les deux requetes partent ensemble: en serie elles couteraient deux
  // allers-retours vers Frankfurt, soit ~600 ms depuis La Reunion.
  const [note, categories] = await Promise.all([
    getNote(params.id),
    getAllCategories(),
  ]);

  return (
    <Card>
      <form action={updateNote}>
        <Input type="hidden" name="id" value={note?.id as string} />
        <CardHeader>
          <CardTitle>Nouvelle note</CardTitle>
          <CardDescription>Quelques mots pour ne pas oublier</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-5">
          <div className="gap-y-2 flex flex-col">
            <Label htmlFor="type">Type</Label>
            {/* Reclasser une note fait partie du tier gratuit: c'est ici qu'on
                corrige une note qui aurait du etre une tache. */}
            <select
              name="type"
              id="type"
              defaultValue={note?.type ?? "NOTE"}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="NOTE">Note</option>
              <option value="TASK">Tâche</option>
              <option value="EVENT">Rendez-vous</option>
            </select>
          </div>
          <div className="gap-y-2 flex flex-col">
            <Label htmlFor="categoryId">Catégorie</Label>
            {/* getAllCategories filtre deja sur l'utilisateur: cette liste ne
                contient que ses categories. L'action reverifie malgre tout
                l'appartenance -- le <select> n'est pas une garantie. */}
            <select
              name="categoryId"
              id="categoryId"
              defaultValue={note?.categoryId ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Sans catégorie</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="gap-y-2 flex flex-col">
            <Label htmlFor="title">Titre</Label>
            <Input
              defaultValue={note?.title as string}
              type="text"
              name="title"
              id="title"
              required
              maxLength={TITLE_MAX}
              placeholder="Titre de la note"
            />
          </div>
          <div className="gap-y-2 flex flex-col">
            <Label htmlFor="content">Contenu</Label>
            <Textarea
              defaultValue={note?.content ?? ""}
              name="content"
              id="content"
              maxLength={CONTENT_MAX}
              placeholder="...🖋️"
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
            Modifier la note
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
