import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createCustomerPortal, getDataStripeUser } from "@/lib/actionsStripe";
import { getUser } from "@/lib/actionsUsers";
import { Check } from "lucide-react";
import { PropsWithChildren } from "react";

export default async function PricingSection() {
  const user = await getUser();

  const dataStripe = await getDataStripeUser(user?.id as string);

  const itemsBasic = [{ name: "100 notes" }];
  const itemsPremium = [
    { name: "500 notes" },
    { name: "Calendrier de rappel" },
    { name: "Assistant IA" },
    { name: "Intégrer votre adresse email" },
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
    <section className="bg-white dark:bg-gray-900">
      <div className="mx-auto mb-8 max-w-screen-md text-center lg:mb-12">
        <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Find the ideal package
        </h2>
        <p className="mb-5 font-light text-gray-500 dark:text-gray-400 sm:text-xl">
          We offer a simple plan for everyone.
        </p>
      </div>
      <div className="flex max-lg:flex-col">
        <PricingCard
          title="Starter"
          price={0}
          description="To try our product"
          items={["Create 100 notes"]}
        />
        <PricingCard
          title="Premium"
          price={15}
          description="For create any "
          items={["Create 100 notes"]}
        />
      </div>
    </section>
  );
}
const PricingCard = (props: PricingCardProps) => {
  return (
    <Card
      style={{
        width: 300,
      }}
      className="h-fit"
    >
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="my-8 flex items-baseline justify-center">
        <span className="mr-2 text-5xl font-extrabold">${props.price}</span>
        <span className="text-muted-foreground">/month</span>
      </CardContent>

      <CardContent>
        <ul role="list" className="mb-8 space-y-4 text-left">
          {props.items.map((item) => (
            <PricingItem key={item}>{item}</PricingItem>
          ))}
        </ul>
      </CardContent>
      <CardFooter>{props.children}</CardFooter>
    </Card>
  );
};

type PricingCardProps = PropsWithChildren<{
  title: string;
  description: string;
  items: string[];
  price: number;
}>;

const PricingItem = ({ children }: PropsWithChildren) => {
  return (
    <li className="flex items-center space-x-3">
      <Check size={16} className="text-green-500" />
      <span>{children}</span>
    </li>
  );
};
