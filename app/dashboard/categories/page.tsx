import CategoryForm from "@/app/components/CategoryForm";
import CategoryItem from "@/app/components/CategoryItem";
import { getAllCategories } from "@/lib/actionsCategories";
import { CATEGORY_MAX_PER_USER } from "@/lib/validationCategories";
import { Tags } from "lucide-react";

// Les categories manuelles sont une fonctionnalite du tier GRATUIT: c'est le
// Premium qui automatise leur attribution, pas leur existence. Pas de
// requirePremium() ici, donc -- seulement getUser(), via getAllCategories.
export default async function PageCategories() {
  const categories = await getAllCategories();

  return (
    <section className="grid items-start gap-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between px-2">
        <div className="grid gap-1">
          <h2 className="text-3xl uppercase font-black">Catégories</h2>
          <p className="text-lg text-muted-foreground">
            Rangez vos notes comme vous le pensez 🏷️
          </p>
          <div className="w-12 bg-white my-2 mx-1 h-[1px]"></div>
        </div>
        <p className="text-sm text-muted-foreground">
          {categories.length} / {CATEGORY_MAX_PER_USER}
        </p>
      </div>

      <CategoryForm />

      {categories.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-md border border-dashed p-3">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-purple-800 bg-opacity-20 mb-4">
            <Tags />
          </div>
          <p>Vous n&apos;avez aucune catégorie</p>
          <p className="text-sm text-muted-foreground mt-1">
            Créez-en une ci-dessus, puis affectez-la à vos notes.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map((category) => (
            <CategoryItem
              key={category.id}
              id={category.id}
              name={category.name}
              color={category.color}
              noteCount={category._count.notes}
            />
          ))}
        </div>
      )}
    </section>
  );
}
