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
import { getNote, updateNote } from "@/app/src/lib/actionsNotes";
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
  const note = await getNote(params.id);

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
            <Label htmlFor="title">Titre</Label>
            <Input
              defaultValue={note?.title as string}
              type="text"
              name="title"
              id="title"
              required
              placeholder="Titre de la note"
            />
          </div>
          <div className="gap-y-2 flex flex-col">
            <Label htmlFor="title">Description</Label>
            <Textarea
              defaultValue={note?.description as string}
              name="description"
              id="description"
              required
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
