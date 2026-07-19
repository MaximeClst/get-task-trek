import type { Note } from "@prisma/client";
import { prisma } from "./db";

// Acces a Google Calendar, sans SDK.
//
// Pourquoi pas `googleapis`: le paquet pese ~50 Mo et embarque les clients de
// toutes les API Google. On appelle trois endpoints REST; `fetch` suffit. Le
// CLAUDE.md demande deja de n'avoir qu'un seul SDK IA -- meme logique ici.
//
// Les credentials vivent dans le modele Account, ou NextAuth les ecrit deja
// (refresh_token, access_token, expires_at, scope). Pas de table parallele.

export const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Deux natures d'echec, qui n'appellent pas la meme reaction:
//   - RECONSENT : il faut que l'utilisateur repasse par Google. Aucun reessai
//     ne peut aider. C'est le cas d'un compte cree AVANT l'ajout du scope
//     calendar.events, ou d'un acces revoque depuis son compte Google.
//   - TEMPORAIRE : reseau, quota, 5xx. Reessayer plus tard a un sens.
export type RaisonEchec = "RECONSENT" | "TEMPORAIRE";

export class ErreurCalendrier extends Error {
  // Champ declare puis affecte, plutot qu'une propriete de parametre
  // (`constructor(public raison: ...)`): cette forme est du sucre propre a
  // TypeScript, que les outils qui se contentent d'effacer les types ne savent
  // pas compiler. La version explicite tourne partout.
  raison: RaisonEchec;

  constructor(raison: RaisonEchec, message: string) {
    super(message);
    this.name = "ErreurCalendrier";
    this.raison = raison;
  }
}

type Credentials = {
  accessToken: string;
};

// Marge de securite: un token qui expire dans 60 s expirera pendant l'appel.
const MARGE_SECONDES = 60;

async function lireCompteGoogle(userId: string) {
  // findFirst et non findUnique: la contrainte unique d'Account porte sur
  // (provider, providerAccountId), pas sur (userId, provider).
  return prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
      scope: true,
    },
  });
}

// Vrai si le compte a bien consenti au scope calendrier. Un compte cree avant
// l'ajout du scope a un access_token parfaitement valide -- qui ne donne juste
// aucun droit sur l'agenda. Sans cette verification, l'erreur n'arriverait
// qu'au moment du push, sous forme de 403 illisible.
export async function aAccesCalendrier(userId: string): Promise<boolean> {
  const compte = await lireCompteGoogle(userId);
  return Boolean(compte?.scope?.includes(CALENDAR_SCOPE));
}

// Rend un access_token valide, en le rafraichissant si besoin.
async function obtenirAccessToken(userId: string): Promise<Credentials> {
  const compte = await lireCompteGoogle(userId);

  if (!compte) {
    throw new ErreurCalendrier(
      "RECONSENT",
      "Aucun compte Google lie a cet utilisateur.",
    );
  }

  if (!compte.scope?.includes(CALENDAR_SCOPE)) {
    throw new ErreurCalendrier(
      "RECONSENT",
      "Le compte Google n'a pas autorise l'acces au calendrier.",
    );
  }

  const maintenant = Math.floor(Date.now() / 1000);
  const encoreValide =
    compte.access_token &&
    compte.expires_at &&
    compte.expires_at - MARGE_SECONDES > maintenant;

  if (encoreValide) {
    return { accessToken: compte.access_token as string };
  }

  if (!compte.refresh_token) {
    // Google ne renvoie un refresh_token qu'au PREMIER consentement, sauf si on
    // force prompt=consent (ce que fait AuthOptions). Un compte ancien peut
    // donc ne pas en avoir: il doit repasser par Google.
    throw new ErreurCalendrier(
      "RECONSENT",
      "Pas de refresh_token: reconnexion Google necessaire.",
    );
  }

  return rafraichir(compte.id, compte.refresh_token);
}

async function rafraichir(
  accountId: string,
  refreshToken: string,
): Promise<Credentials> {
  let reponse: Response;

  try {
    reponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
  } catch (error) {
    console.error("Rafraichissement du token Google injoignable :", error);
    throw new ErreurCalendrier("TEMPORAIRE", "Google est injoignable.");
  }

  if (!reponse.ok) {
    const detail = await reponse.text();

    // invalid_grant = le refresh_token est mort (revoque, ou expire apres
    // 6 mois d'inactivite). Aucun reessai ne le ressuscitera.
    if (reponse.status === 400 || reponse.status === 401) {
      console.error("Refresh token Google refuse :", detail.slice(0, 300));
      throw new ErreurCalendrier(
        "RECONSENT",
        "L'autorisation Google a expire ou a ete revoquee.",
      );
    }

    console.error("Rafraichissement du token en echec :", reponse.status);
    throw new ErreurCalendrier("TEMPORAIRE", "Google a refuse la demande.");
  }

  const donnees = (await reponse.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };

  if (!donnees.access_token) {
    throw new ErreurCalendrier("TEMPORAIRE", "Reponse Google inexploitable.");
  }

  const expiresAt =
    Math.floor(Date.now() / 1000) + (donnees.expires_in ?? 3600);

  // On persiste immediatement: sinon chaque requete rafraichirait a nouveau, ce
  // qui ajoute un aller-retour vers Google a chaque push et finit par se faire
  // limiter.
  await prisma.account.update({
    where: { id: accountId },
    data: {
      access_token: donnees.access_token,
      expires_at: expiresAt,
      // Google ne renvoie generalement PAS de nouveau refresh_token. Ne jamais
      // ecraser celui qu'on a par un undefined -- ce serait deconnecter
      // l'utilisateur a la premiere rotation.
      ...(donnees.refresh_token
        ? { refresh_token: donnees.refresh_token }
        : {}),
    },
  });

  return { accessToken: donnees.access_token };
}

// Projette une Note en evenement Google. Une note sans startAt n'est pas
// projetable: c'est a l'appelant de le verifier avant.
//
// Exportee pour etre verifiable: c'est la fonction ou une erreur d'un jour ne
// se voit pas en relisant le code, seulement dans l'agenda de l'utilisateur.
export function versEvenementGoogle(note: Note) {
  const debut = note.startAt as Date;
  // Un rendez-vous sans fin dure une heure. Google refuse un evenement sans
  // date de fin, et inventer une duree est moins mauvais que refuser le push.
  const fin = note.endAt ?? new Date(debut.getTime() + 60 * 60 * 1000);

  if (note.allDay) {
    // Sur un evenement "toute la journee", Google veut des dates nues et sa
    // date de fin est EXCLUSIVE: un evenement du 23 se termine le 24.
    //
    // Nos propres donnees stockent la fin a 23:59:59 LE MEME JOUR (voir
    // /api/events). Recopier cette date telle quelle donnerait donc un
    // evenement de duree nulle, qui n'apparait tout simplement pas dans
    // l'agenda. On ajoute un jour a la date de fin, ce qui vaut aussi bien
    // pour un evenement d'un jour que pour un evenement de plusieurs.
    const jour = (d: Date) => d.toISOString().slice(0, 10);
    const finIncluse = note.endAt ?? debut;
    const finExclusive = new Date(finIncluse.getTime() + 24 * 60 * 60 * 1000);

    return {
      summary: note.title,
      description: note.content ?? undefined,
      start: { date: jour(debut) },
      end: { date: jour(finExclusive) },
    };
  }

  // On envoie des instants UTC. Google les affiche dans le fuseau de l'agenda
  // de l'utilisateur, donc pas besoin de connaitre le sien ici.
  return {
    summary: note.title,
    description: note.content ?? undefined,
    start: { dateTime: debut.toISOString(), timeZone: "UTC" },
    end: { dateTime: fin.toISOString(), timeZone: "UTC" },
  };
}

async function appelerCalendrier(
  accessToken: string,
  url: string,
  methode: "POST" | "PATCH" | "DELETE",
  corps?: unknown,
): Promise<Response> {
  let reponse: Response;

  try {
    reponse = await fetch(url, {
      method: methode,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: corps ? JSON.stringify(corps) : undefined,
    });
  } catch (error) {
    console.error("Google Calendar injoignable :", error);
    throw new ErreurCalendrier("TEMPORAIRE", "Google Calendar est injoignable.");
  }

  if (reponse.ok || reponse.status === 404 || reponse.status === 410) {
    return reponse;
  }

  if (reponse.status === 401 || reponse.status === 403) {
    console.error("Google Calendar refuse l'acces :", reponse.status);
    throw new ErreurCalendrier(
      "RECONSENT",
      "Google a refuse l'acces au calendrier.",
    );
  }

  console.error("Google Calendar en erreur :", reponse.status);
  throw new ErreurCalendrier("TEMPORAIRE", "Google Calendar a repondu en erreur.");
}

// Cree l'evenement, ou le met a jour s'il a deja ete pousse. Rend l'identifiant
// Google, que l'appelant persiste dans Note.googleEventId.
//
// Idempotent: rappelee sur une note deja poussee, elle met a jour au lieu de
// creer un doublon. C'est ce qui permet de reessayer sans risque.
export async function pousserEvenement(note: Note): Promise<string> {
  if (!note.startAt) {
    throw new ErreurCalendrier(
      "TEMPORAIRE",
      "Un rendez-vous sans date ne peut pas partir au calendrier.",
    );
  }

  const { accessToken } = await obtenirAccessToken(note.userId);
  const corps = versEvenementGoogle(note);

  if (note.googleEventId) {
    const reponse = await appelerCalendrier(
      accessToken,
      `${CALENDAR_URL}/${encodeURIComponent(note.googleEventId)}`,
      "PATCH",
      corps,
    );

    // L'evenement a ete supprime cote Google: on le recree plutot que de
    // laisser la note pointer dans le vide.
    if (reponse.status !== 404 && reponse.status !== 410) {
      return note.googleEventId;
    }
  }

  const reponse = await appelerCalendrier(accessToken, CALENDAR_URL, "POST", corps);
  const cree = (await reponse.json()) as { id?: string };

  if (!cree.id) {
    throw new ErreurCalendrier("TEMPORAIRE", "Google n'a pas rendu d'identifiant.");
  }

  return cree.id;
}

// Retire l'evenement de l'agenda. Un 404 est un SUCCES: si l'evenement n'est
// plus la, l'objectif est atteint.
export async function supprimerEvenement(
  userId: string,
  googleEventId: string,
): Promise<void> {
  const { accessToken } = await obtenirAccessToken(userId);

  await appelerCalendrier(
    accessToken,
    `${CALENDAR_URL}/${encodeURIComponent(googleEventId)}`,
    "DELETE",
  );
}
