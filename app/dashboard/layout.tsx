import { getUser } from "@/app/src/lib/actionsUsers";
import { prisma } from "@/app/src/lib/db";
import { stripe } from "@/app/src/lib/stripe";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ButtonSignOut from "../components/ButtonSignOut";
import DashboardNav from "../components/DashboardNav";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getUser();

  if (!user) {
    return <div>Veuillez vous connectez</div>;
  }

  if (!user?.stripeCustomerId) {
    try {
      const stripeCustomer = await stripe.customers.create({
        email: user?.email as string,
      });

      await prisma.user.update({
        where: {
          id: user?.id as string,
        },
        data: {
          stripeCustomerId: stripeCustomer.id as string,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la création du customer stripe :", error);
      return <div>Erreur lors de la création du customer stripe</div>;
    }
  }

  return (
    <section className="max-w-[1200px] mx-auto md:flex md:items-center md:gap-4 h-screen w-full mt-2 p-2">
      <DashboardNav />
      <div className="w-full h-full">
        <ButtonSignOut />
        {children}
        <ToastContainer />
      </div>
    </section>
  );
}
