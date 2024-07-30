import ButtonDelete from "@/app/components/ButtonDelete";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAllNotes } from "@/lib/actionsNotes";
import { getUser } from "@/lib/actionsUsers";
import { File, FilePenLine } from "lucide-react";
import Link from "next/link";

export default async function PageNotes() {
  const user = await getUser();
  const data = await getAllNotes(user?.id as string);
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
              <div>
                <h2 className="text-purple-400 text-xl font-bold">
                  {item.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  écrit le{" "}
                  {new Intl.DateTimeFormat("fr-FR", {
                    dateStyle: "full",
                  }).format(new Date(item.createdAt))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="bg-yellow-400 hover:bg-yellow-500 mt-4 text-white mb-3"
                >
                  <Link href={`notes/note/${item.id}`}>
                    <FilePenLine className="w-4" />
                  </Link>
                </Button>
                <ButtonDelete id={item.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
