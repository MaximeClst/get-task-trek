import { NextResponse, type NextRequest } from "next/server";

// Filtre de premiere ligne sur /dashboard/**. Ce qu'il fait, et surtout ce
// qu'il ne fait PAS -- a lire avant de lui faire confiance.
//
// Les sessions sont stockees EN BASE (PrismaAdapter sans strategy: "jwt"): le
// cookie ne porte qu'un identifiant opaque, pas un JWT signe. On ne peut donc
// pas le verifier ici. withAuth() / getToken() de NextAuth dechiffrent un JWT
// et renverraient null pour tout le monde -- y compris les comptes valides,
// qui se retrouveraient rediriges vers /login en boucle.
//
// Le middleware tourne sur l'Edge: pas de Prisma, donc pas de lecture en base
// non plus. (Le runtime Node pour le middleware n'existe qu'a partir de
// Next 15.2; on est en 14.2.5.)
//
// Ce middleware ne fait donc qu'une chose: constater la PRESENCE d'un cookie de
// session. C'est une porte, pas un controle d'identite.
//
//   - Il coupe le trafic anonyme avant qu'il n'atteigne la base. Non trivial
//     ici: un visiteur non connecte declenche sinon un getServerSession, soit
//     un aller-retour vers Frankfurt (~300 ms depuis La Reunion).
//   - Il ne valide RIEN. Un cookie bidon fabrique a la main passe cette porte.
//
// La vraie autorisation reste donc, sans exception, cote page/action:
// getUser() (identite) et requirePremium() (offre), qui relisent la base.
// Voir CLAUDE.md, regles 1 et 2.

// NextAuth prefixe le cookie de __Secure- des que la connexion est en HTTPS.
const SESSION_COOKIES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export function middleware(request: NextRequest) {
  const hasSessionCookie = SESSION_COOKIES.some((name) =>
    request.cookies.has(name)
  );

  if (hasSessionCookie) {
    return NextResponse.next();
  }

  // On garde la destination pour y revenir apres connexion, plutot que de
  // deposer l'utilisateur sur une page d'accueil de dashboard arbitraire.
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "callbackUrl",
    request.nextUrl.pathname + request.nextUrl.search
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
