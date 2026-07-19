import { prisma } from "@/lib/db";
import { CALENDAR_SCOPE } from "@/lib/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Google est le seul provider: le calendrier repose sur les tokens OAuth Google
// stockes dans Account. Un utilisateur inscrit autrement n'aurait pas de calendrier.
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          // openid/email/profile sont les scopes par defaut de NextAuth: les
          // reciter est necessaire des qu'on surcharge `scope`, sinon on les
          // perd et la session n'a plus ni e-mail ni nom.
          scope: `openid email profile ${CALENDAR_SCOPE}`,
          // Sans access_type=offline, Google ne delivre AUCUN refresh_token:
          // l'acces au calendrier mourrait au bout d'une heure, definitivement.
          access_type: "offline",
          // Google ne renvoie un refresh_token qu'au TOUT PREMIER consentement.
          // Un utilisateur deja inscrit avant l'ajout du scope calendrier n'en
          // recevrait donc jamais. prompt=consent force l'ecran d'autorisation
          // a chaque connexion, et avec lui un refresh_token a chaque fois.
          // Le cout est un ecran de plus a la reconnexion; l'alternative est un
          // calendrier qui ne marche que pour les futurs inscrits.
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    // NextAuth v4 ne met PAS a jour un Account deja lie: a la reconnexion, il
    // trouve le compte via getUserByAccount et se contente d'ouvrir la session.
    // Les nouveaux tokens -- et surtout le nouveau `scope` -- seraient donc
    // jetes, et l'ajout du scope calendrier n'aurait d'effet que pour les
    // comptes crees apres. On les ecrit nous-memes.
    signIn: async ({ account }) => {
      if (account?.provider === "google") {
        try {
          await prisma.account.updateMany({
            where: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
            data: {
              access_token: account.access_token,
              expires_at: account.expires_at,
              scope: account.scope,
              id_token: account.id_token,
              // Ne jamais ecraser un refresh_token existant par un undefined:
              // Google n'en renvoie pas systematiquement, et le perdre
              // couperait l'acces au calendrier sans moyen de le retrouver.
              ...(account.refresh_token
                ? { refresh_token: account.refresh_token }
                : {}),
            },
          });
        } catch (error) {
          // Un echec de mise a jour ne doit pas empecher de se connecter:
          // l'utilisateur perdrait l'acces a l'application entiere pour un
          // probleme de calendrier.
          console.error("Mise a jour des tokens Google impossible :", error);
        }
      }

      return true;
    },
    session: async ({ session, user }) => {
      if (session.user) {
        session.user.id = user.id;
        session.user.isPremium = user.isPremium;
      }
      return session;
    },
  },
};
