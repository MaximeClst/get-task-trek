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
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function CreatePage() {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    console.log("Start: ", start, "End: ", end);

    if (startParam) setStart(startParam);
    if (endParam) setEnd(endParam);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("title", title);
    formData.append("desdescription", description);
    formData.append("start", start);
    formData.append("end", end);

    await createNote(formData);

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
              className="bg-purple-400 hover:bg-purple-500 text-white"
            >
              Créer une note
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  };
}
