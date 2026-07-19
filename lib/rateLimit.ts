import { prisma } from "./db";

// Limitation de debit adossee a Postgres.
//
// Pourquoi pas express-rate-limit (l'ancien lib/rateLimiter.ts): c'est un
// middleware Express, il ne tourne pas dans l'App Router. Pourquoi pas un
// compteur en memoire: sur Vercel chaque instance a la sienne, et elles vont et
// viennent -- un compteur local ne compte rien. Le seul etat partage dont on
// dispose deja est la base.
//
// Pourquoi pas Upstash/Redis: ce serait plus rapide et plus fin, mais cela
// demande un service externe et deux variables d'environnement de plus pour une
// application qui n'a pas encore d'utilisateurs. Le jour ou le volume le
// justifie, seul ce fichier change -- les appelants ne voient qu'une fonction.
//
// Fenetre fixe plutot que glissante: une seule ligne par couple
// (action, utilisateur), mise a jour en place. La table ne grossit pas avec le
// trafic. Le defaut connu de la fenetre fixe est qu'on peut passer 2x la limite
// a cheval sur deux fenetres; sans consequence pour des plafonds anti-abus.

export type RateLimitRule = {
  limit: number;
  windowSeconds: number;
};

// Des plafonds anti-abus, pas des quotas produit. Un utilisateur normal ne doit
// jamais les atteindre; le quota de 10 notes du tier gratuit vit ailleurs, dans
// createNote.
export const RATE_LIMITS = {
  // Creation de note: l'usage normal est de quelques-unes par minute.
  createNote: { limit: 30, windowSeconds: 60 },
  // Idem pour les rendez-vous (Premium).
  createEvent: { limit: 30, windowSeconds: 60 },
  // On cree une categorie de temps en temps, pas en rafale.
  createCategory: { limit: 20, windowSeconds: 60 },
  // Le SEUL plafond qui protege de l'argent reel. Whisper coute ~0,006 $/min et
  // il est ouvert au tier gratuit. 20 dictees de 2 min par heure plafonnent un
  // compte a ~0,24 $/h dans le pire des cas. Fenetre horaire et non minute:
  // c'est la consommation cumulee qui coute, pas la rafale.
  transcribe: { limit: 20, windowSeconds: 3600 },
  // Push et retrait au calendrier. Chaque appel part chez Google, qui applique
  // ses propres quotas par projet: se faire limiter par Google penaliserait
  // TOUS nos utilisateurs, pas seulement celui qui martele.
  calendrier: { limit: 30, windowSeconds: 60 },
  // Chaque appel declenche DEUX appels a l'API Stripe. Personne n'a besoin
  // d'ouvrir cinq tunnels de paiement par minute.
  createSubscription: { limit: 5, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitedAction = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export async function checkRateLimit(
  action: RateLimitedAction,
  userId: string
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[action];
  const windowMs = windowSeconds * 1000;

  // Fenetre alignee sur l'horloge: tous les appels d'une meme minute tombent
  // dans le meme seau, sans avoir a lire la ligne avant de l'ecrire.
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const key = `${action}:${userId}`;

  try {
    // Un seul aller-retour, et atomique: c'est Postgres qui incremente. Lire
    // puis ecrire en deux temps laisserait deux requetes simultanees passer
    // toutes les deux -- exactement ce qu'un limiteur doit empecher.
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "windowStart")
      VALUES (${key}, 1, ${windowStart})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."windowStart" < ${windowStart} THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "windowStart" = CASE
          WHEN "RateLimit"."windowStart" < ${windowStart} THEN ${windowStart}
          ELSE "RateLimit"."windowStart"
        END
      RETURNING "count"
    `;

    const count = rows[0]?.count ?? 1;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000)
    );

    return { allowed: count <= limit, retryAfterSeconds };
  } catch (error) {
    // Choix assume: on laisse passer si le limiteur lui-meme echoue. Bloquer
    // une creation de note parce que la table de comptage a hoquete punirait
    // l'utilisateur pour une panne qui n'est pas la sienne -- et si la base est
    // vraiment tombee, l'operation protegee echouera de toute facon juste apres.
    console.error("Rate limit indisponible, requete laissee passer:", error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

// Pour les Server Actions, qui signalent leurs erreurs en levant.
export async function enforceRateLimit(
  action: RateLimitedAction,
  userId: string
): Promise<void> {
  const { allowed, retryAfterSeconds } = await checkRateLimit(action, userId);

  if (!allowed) {
    throw new Error(
      `Trop de requetes. Reessayez dans ${retryAfterSeconds} seconde${
        retryAfterSeconds > 1 ? "s" : ""
      }.`
    );
  }
}
