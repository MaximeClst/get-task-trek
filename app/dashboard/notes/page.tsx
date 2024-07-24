import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getUser } from "@/lib/actionsUsers";
import { getAllNotes } from "@/lib/actionsNotes";
import { File, FilePenLine } from "lucide-react";

export default function PageNotes() {
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
    </section>
  );
}
