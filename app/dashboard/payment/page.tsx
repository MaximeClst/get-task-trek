import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createCustomerPortal, getDataStripeUser } from "@/lib/actionsStripe";
import { getUser } from "@/lib/actionsUsers";

export default async function PagePayment() {
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

  //   return (
  //     <section>
  //       <div className="mx-auto mb-8 max-w-screen-md text-center lg:mb-12">
  //         <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
  //           Find the ideal package
  //         </h2>
  //         <p className="mb-5 font-light text-gray-500 dark:text-gray-400 sm:text-xl">
  //           We offer a simple plan for everyone.
  //         </p>
  //       </div>
  //       <div className="max-w-lg mx-auto space-y-4 mt-3 flex-1 gap-4">
  //         <Card
  //           style={{
  //             width: 300,
  //           }}
  //           className="h-fit"
  //         >
  //           <CardContent className="py-8">
  //             <div>
  //               <h3 className="text-md font-black uppercase bg-purple-800 bg-opacity-20 text-purple-500 p-3 rounded-md inline">
  //                 Basic Pass
  //               </h3>
  //             </div>
  //             <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
  //               FREE
  //             </h2>
  //             <div className="flex-1 flex justify-center px-6 py-4 bg-secondary rounded-lg m-1 space-t-6 p-3 mt-4">
  //               <ul className="space-y-3">
  //                 {itemsBasic.map((item, index) => (
  //                   <li key={index} className="flex items-center gap-2">
  //                     <span>✅</span>
  //                     <span>{item.name}</span>
  //                   </li>
  //                 ))}
  //               </ul>
  //               {/* <Button
  //                 className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white"
  //                 onClick={() => signIn}
  //               >
  //                 Sign Up
  //               </Button> */}
  //             </div>
  //           </CardContent>
  //         </Card>

  //         <Card className="flex flex-col">
  //           <CardContent className="py-8">
  //             <div>
  //               <h3 className="text-md font-black uppercase bg-purple-800 bg-opacity-20 text-purple-500 p-3 rounded-md inline">
  //                 Pass Premium
  //               </h3>
  //             </div>
  //             <div className="mt-4 text-6xl font-black">
  //               <span>19,99 €</span>
  //               <span className="text-sm text-muted-foreground">/ par mois</span>
  //             </div>
  //             <p className="mt-4 text-muted-foreground">
  //               Débloquer un nouveau niveau de productivité personnelle 💥
  //             </p>
  //             <div className="flex-1 flex flex-col justify-between px-6 py-4 bg-secondary rounded-lg m-1 space-t-6 p-3 mt-4">
  //               <ul className="space-y-3">
  //                 {itemsPremium.map((item, index) => (
  //                   <li key={index} className="flex items-center gap-2">
  //                     <span>✅</span>
  //                     <span>{item.name}</span>
  //                   </li>
  //                 ))}
  //               </ul>
  //               <form action={createSubscription} className="w-full mt-4">
  //                 <Button className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white">
  //                   Devenir membre Premium
  //                 </Button>
  //               </form>
  //             </div>
  //           </CardContent>
  //         </Card>
  //       </div>
  //     </section>
  //   );
}

<div className="space-y-8 lg:grid lg:grid-cols-3 sm:gap-6 xl:gap-10 lg:space-y-0">
  {/* Pricing Card  */}
  <div className="flex flex-col p-6 mx-auto max-w-lg text-center text-gray-900 bg-white rounded-lg border border-gray-100 shadow dark:border-gray-600 xl:p-8 dark:bg-gray-800 dark:text-white">
    <h3 className="mb-4 text-2xl font-semibold">Starter</h3>
    <p className="font-light text-gray-500 sm:text-lg dark:text-gray-400">
      Best option for personal use & for your next project.
    </p>
    <div className="flex justify-center items-baseline my-8">
      <span className="mr-2 text-5xl font-extrabold">$29</span>
      <span className="text-gray-500 dark:text-gray-400">/month</span>
    </div>
    {/* <!-- List --> */}
    <ul role="list" className="mb-8 space-y-4 text-left">
      <li className="flex items-center space-x-3">
        {/* <!-- Icon --> */}
        <svg
          className="flex-shrink-0 w-5 h-5 text-green-500 dark:text-green-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clip-rule="evenodd"
          ></path>
        </svg>
        <span>Individual configuration</span>
      </li>
      <li className="flex items-center space-x-3">
        {/* <!-- Icon --> */}
        <svg
          className="flex-shrink-0 w-5 h-5 text-green-500 dark:text-green-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clip-rule="evenodd"
          ></path>
        </svg>
        <span>No setup, or hidden fees</span>
      </li>
      <li className="flex items-center space-x-3">
        {/* <!-- Icon --> */}
        <svg
          className="flex-shrink-0 w-5 h-5 text-green-500 dark:text-green-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clip-rule="evenodd"
          ></path>
        </svg>
        <span>
          Team size: <span className="font-semibold">1 developer</span>
        </span>
      </li>
      <li className="flex items-center space-x-3">
        {/* <!-- Icon --> */}
        <svg
          className="flex-shrink-0 w-5 h-5 text-green-500 dark:text-green-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clip-rule="evenodd"
          ></path>
        </svg>
        <span>
          Premium support: <span className="font-semibold">6 months</span>
        </span>
      </li>
      <li className="flex items-center space-x-3">
        {/* <!-- Icon --> */}
        <svg
          className="flex-shrink-0 w-5 h-5 text-green-500 dark:text-green-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clip-rule="evenodd"
          ></path>
        </svg>
        <span>
          Free updates: <span className="font-semibold">6 months</span>
        </span>
      </li>
    </ul>
    <a
      href="#"
      className="text-white bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:text-white  dark:focus:ring-primary-900"
    >
      Get started
    </a>
  </div>
</div>;
