import ButtonDelete from "@/app/components/ButtonDelete";
import { Button } from "@/app/src/components/ui/button";
import { Card } from "@/app/src/components/ui/card";
import { getAllNotes } from "@/lib/actionsNotes";
import { File } from "lucide-react";
import Link from "next/link";
import type { NoteType } from "@prisma/client";

const TYPE_LABELS: Record<NoteType, string> = {
  NOTE: "Note",
  TASK: "Tâche",
  EVENT: "Rendez-vous",
};

export default async function PageNotes() {
  // getAllNotes() ne prend plus d'userId: elle resout l'utilisateur elle-meme.
  const data = await getAllNotes();
  return (
    <section className="grid items-start gap-y-4">
      <div className="flex items-center md:items-center md:justify-between flex-col md:flex-row px-2">
        <div className="grid gap-1">
          <h2 className="text-3xl uppercase font-black">Notes</h2>
          <p className="text-lg text-muted-foreground">
            Ne perdez pas vos idées, prenez des notes 🗒️
          </p>
          <div className="w-12 bg-white my-2 mx-1 h-[1px]"></div>
        </div>
        <Button>
          <Link href="/dashboard/notes/create">Crée une note 🖋️</Link>
        </Button>
      </div>

      {data.length < 1 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed p-3">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-purple-800 bg-opacity-20 mb-4">
            <File />
          </div>
          <p className="">Vous n'avez aucune note</p>
          <Button className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white mt-4">
            <Link href="/dashboard/notes/create">Crée une nouvelle note</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
          {data?.map((item, index) => (
            <Card key={index} className="flex items-center justify-between p-4">
              <div className="flex flex-col gap-1">
                <Link href={`notes/note/${item.id}`}>
                  <h2 className="text-purple-400 text-xl font-bold">
                    {item.title}
                  </h2>
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded border px-1.5 py-0.5">
                    {TYPE_LABELS[item.type]}
                  </span>
                  {item.startAt && (
                    <span>
                      {item.startAt.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {item.category && <span>· {item.category.name}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ButtonDelete id={item.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
