import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  createCustomerPortal,
  createSubscription,
  getDataStripeUser,
} from "@/lib/actionsStripe";
import { getUser } from "@/lib/actionsUsers";
import Link from "next/link";

export default async function PagePayment() {
  const user = await getUser();

  if (!user) {
    return <div>Veuillez vous connecter pour accéder à cette page.</div>;
  }

  const dataStripe = await getDataStripeUser(user.id);

  const itemsBasic = [{ name: "Get 10 notes" }, { name: "Edit your notes " }];
  const itemsPremium = [
    { name: "Unlimited notes" },
    { name: "Calendar" },
    { name: "AI assistant" },
  ];

  if (dataStripe?.status === "active") {
    return (
      <div className="max-w-lg mx-auto space-y-4 my-3">
        <Card className="flex flex-col">
          <CardContent className="py-8">
            <div>
              <h3 className="text-md font-black uppercase bg-purple-900 bg-opacity-20 text-purple-400 p-3 rounded-md inline">
                Pass Premium
              </h3>
              <p className="mt-4 text-sm text-muted-foreground">
                Modifier votre abonnement premium
              </p>

              <form className="w-full mt-4" action={createCustomerPortal}>
                <Button className="bg-gradient-to-r from-fuchsia-500 to-cyan-500">
                  Modifier abonnement
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <section>
      <div className="mx-auto mb-8 max-w-screen-md text-center lg:mb-12">
        <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Find the ideal package
        </h2>
        <p className="mb-5 font-light text-gray-500 dark:text-gray-400 sm:text-xl">
          We offer a simple plan for everyone.
        </p>
      </div>
      <div className="flex flex-row justify-center gap-4 max-lg:flex-col">
        <Card
          style={{
            width: 300,
          }}
          className="h-fit flex-1"
        >
          <CardContent className="py-8">
            <div>
              <h3 className="text-md font-black uppercase bg-purple-800 bg-opacity-20 text-purple-500 p-3 rounded-md inline">
                Starter
              </h3>
            </div>
            <div className="mt-4 text-6xl font-black">
              <span>FREE</span>
            </div>
            <p className="mt-4 text-muted-foreground">Testing our product</p>
            <div className="flex-1 flex flex-col justify-between px-6 py-4 bg-secondary rounded-lg m-1 space-t-6 p-3 mt-4">
              <ul className="space-y-3">
                {itemsBasic.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span>✅</span>
                    <span>{item.name}</span>
                  </li>
                ))}
              </ul>
              <Link href="/" className="w-full mt-4">
                <Button className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white">
                  Sign Up
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card
          style={{
            width: 300,
          }}
          className="h-fit flex-1"
        >
          <CardContent className="py-8">
            <div>
              <h3 className="text-md font-black uppercase bg-purple-800 bg-opacity-20 text-purple-500 p-3 rounded-md inline">
                Premium
              </h3>
            </div>
            <div className="mt-4 text-6xl font-black">
              <span>8.99 €</span>
              <span className="text-sm text-muted-foreground">/per month</span>
            </div>
            <p className="mt-4 text-muted-foreground">
              Unlocking a new level of personal productivity.
            </p>
            <div className="flex-1 flex flex-col justify-between px-6 py-4 bg-secondary rounded-lg m-1 space-t-6 p-3 mt-4">
              <ul className="space-y-3">
                {itemsPremium.map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span>✅</span>
                    <span>{item.name}</span>
                  </li>
                ))}
              </ul>
              <form action={createSubscription} className="w-full mt-4">
                <Button className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white">
                  Grab it
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
