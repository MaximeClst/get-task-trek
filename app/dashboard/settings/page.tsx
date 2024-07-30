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
import { deleteUser, getUser, updateUser } from "@/lib/actionsUsers";
import Image from "next/image";

export default async function PageSettings() {
  const user = await getUser();

  return (
    <section className="border border-gray-200 rounded-md p-3">
      <h2 className="text-3xl uppercase font-black">Settings</h2>
      <p className="text-lg text-muted-foreground">Vos paramètres de profil</p>

      <div className="w-12 bg-white my-2 mx-1 h-[1px]"></div>

      <form action={updateUser}>
        <Input type="hidden" name="id" value={user?.id} />
        <Card>
          <CardHeader>
            <CardTitle>Paramètres globales</CardTitle>
            <CardDescription>
              Modifier vos informations puis sauvegarder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user?.image && (
              <Image
                width={100}
                height={100}
                alt="Photo de profil"
                src={user?.image}
                className="w-16 h-16 object-contain mb-4 rounded-full"
              />
            )}
            <div className="space-y-1 mb-2">
              <Label htmlFor="idUser">ID</Label>
              <Input
                type="text"
                name="idUser"
                id="idUser"
                disabled
                defaultValue={user?.id || ""}
              />
            </div>
            <div className="space-y-1 mb-2">
              <Label htmlFor="name">Nom</Label>
              <Input
                type="text"
                name="name"
                id="name"
                defaultValue={user?.name || ""}
              />
            </div>
            <div className="space-y-1 mb-2">
              <Label htmlFor="email">Email</Label>
              <Input
                type="email"
                name="email"
                id="email"
                disabled
                defaultValue={user?.email || ""}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Modifier</Button>
          </CardFooter>
        </Card>
      </form>

      <form action={deleteUser}>
        <Input type="hidden" name="id" value="" />
        <Button className="bg-red-500 mx-1 my-2 hover:bg-red-600 text-white">
          Supprimer votre compte
        </Button>
      </form>
    </section>
  );
}
