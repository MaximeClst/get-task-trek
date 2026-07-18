import CreateNoteForm from "@/app/components/CreateNoteForm";
import { getAllCategories } from "@/lib/actionsCategories";
import { Suspense } from "react";

// Server Component: il charge les categories une fois, cote serveur, et les
// passe au formulaire. Le formulaire lui-meme reste "use client" (il gere de
// l'etat local et useSearchParams).
export default async function CreateNotePage() {
  const categories = await getAllCategories();

  return (
    // useSearchParams exige une frontiere Suspense pour ne pas forcer tout
    // l'arbre en rendu client.
    <Suspense fallback={null}>
      <CreateNoteForm
        categories={categories.map(({ id, name }) => ({ id, name }))}
      />
    </Suspense>
  );
}
