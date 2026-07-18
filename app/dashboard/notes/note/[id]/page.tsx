import SubmitButton from "@/app/components/SubmitButton";
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
import { getAllCategories } from "@/lib/actionsCategories";
import { getNote, updateNote } from "@/lib/actionsNotes";
import { CONTENT_MAX, TITLE_MAX } from "@/lib/validationNotes";
import Link from "next/link";
import { notFound } from "next/navigation";

// PAS de "use client" ici, et c'est tout l'enjeu de ce fichier.
//
// Il etait a la fois "use client" ET `export default async function`, tout en
// appelant getNote() et getAllCategories(), qui sont des Server Actions. React
// ne supporte pas les composants client asynchrones: chaque tentative de rendu
// relancait les actions (un POST chacune), dont la resolution relancait un
// rendu, en boucle. La page ne s'ouvrait jamais et le terminal se remplissait
// de POST.
//
// Rien ici n'a besoin du client: aucun hook, aucun etat. Le <form> appelle
// directement la Server Action, et l'etat d'attente du bouton vit dans
// SubmitButton, un petit composant client enfant du formulaire.
export default async function PageNote({
  params,
}: {
  params: { id: string };
}) {
  // Les deux requetes partent ensemble: en serie elles couteraient deux
  // allers-retours vers Frankfurt, soit ~600 ms depuis La Reunion.
  const [note, categories] = await Promise.all([
    getNote(params.id),
    getAllCategories(),
  ]);

  // getNote filtre sur userId: une note inexistante et la note d'un autre
  // rendent toutes deux null. On repond 404 dans les deux cas -- distinguer
  // les deux revelerait quelles notes existent.
  if (!note) {
    notFound();
  }

  return (
    <Card>
      <form action={updateNote}>
        <input type="hidden" name="id" value={note.id} />
        <CardHeader>
          <CardTitle>Modifier la note</CardTitle>
          <CardDescription>Relisez, corrigez, rangez</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-5">
          <div className="gap-y-2 flex flex-col">
            <Label htmlFor="type">Type</Label>
            {/* Reclasser une note fait partie du tier gratuit: c'est ici qu'on
                corrige une note qui aurait du etre une tache. */}
            <select
              name="type"
              id="type"
              defaultValue={note.type}
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
              defaultValue={note.categoryId ?? ""}
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
              defaultValue={note.title}
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
              defaultValue={note.content ?? ""}
              name="content"
              id="content"
              rows={6}
              maxLength={CONTENT_MAX}
              placeholder="...🖋️"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="completed"
              id="completed"
              defaultChecked={note.completed}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="completed">Terminée</Label>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          {/* Un <Link> dans un <Button> imbriquait deux elements interactifs.
              Le lien porte desormais le style, sans bouton autour. */}
          <Button asChild variant="secondary">
            <Link href="/dashboard/notes">Annuler</Link>
          </Button>
          <SubmitButton className="bg-purple-400 hover:bg-purple-500 text-white">
            Modifier la note
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
