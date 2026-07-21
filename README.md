# Task Trek

Transforme de la parole en notes, tâches et rendez-vous organisés.

La boucle centrale : on dicte → la parole est transcrite → un item est créé → il est *classé*
(note / tâche / rendez-vous) et *catégorisé* → si c'est un rendez-vous, il part dans Google
Calendar.

## Free et Premium

La différence entre les deux offres n'est **pas** la dictée : c'est **qui fait le travail de tri**.
En Free, l'IA n'intervient que pour la transcription ; tout le reste est saisi à la main.

|                                 | Free          | Premium         |
| ------------------------------- | ------------- | --------------- |
| Dictée + transcription          | ✅            | ✅              |
| Classement (note / tâche / RDV) | manuel        | **IA**          |
| Catégorisation                  | manuel        | **IA**          |
| Ajout à Google Calendar         | manuel        | **automatique** |
| Rappels e-mail                  | ❌            | ✅              |
| Nombre de notes                 | 10            | illimité        |
| Transcription                   | 30 min / mois | 10 h / mois     |

Premium : 15,99 €/mois.

## Stack

- **Next.js 14** (App Router), TypeScript `strict`
- **Prisma + PostgreSQL** (Neon en production)
- **NextAuth v4** — provider Google uniquement, sessions en base
- **Stripe** — abonnement Premium
- **OpenAI** — Whisper pour la transcription, `gpt-4o-mini` pour le tri
- **Google Calendar API** — en REST, sans SDK
- **Resend** + **Vercel Cron** — rappels e-mail
- **Tailwind + shadcn/ui**, `next-themes`, `lucide-react`

## Démarrer

```bash
pnpm install --frozen-lockfile
npx prisma generate          # sinon : types Prisma manquants, et de faux TS7006
npx prisma migrate deploy
pnpm dev
```

Copier `.env.example` en `.env` et remplir — **aucune variable n'a de valeur par défaut**, et une
variable manquante échoue au *runtime*, pas au build.

Pour recevoir les webhooks Stripe en local, il faut en plus que cette commande tourne, et que
`STRIPE_WEBHOOK_SECRET` vaille le `whsec_` qu'elle imprime (sinon la signature part en 400) :

```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

## Vérifier le projet

```bash
pnpm lint
node node_modules/typescript/lib/tsc.js --noEmit   # `npx tsc` installe un paquet "tsc" pirate
pnpm test                                          # vitest — ni base ni réseau
NEXT_DIST_DIR=.next-verify pnpm build
```

⚠️ **Ne jamais lancer `pnpm build` nu pendant que `next dev` tourne.** Les deux écrivent dans
`.next/` : le build écrase les chunks servis par le serveur de dev et **la page perd son CSS**
jusqu'au rechargement suivant. Le symptôme ressemble à un bug Tailwind, n'en est pas. D'où
`NEXT_DIST_DIR`, qui isole les builds de vérification.

⚠️ Un `node_modules` corrompu produit une quarantaine de **fausses** erreurs TypeScript
(« Property 'children' does not exist… », `TS7006`). Ce n'est pas le code : réinstaller et
relancer `prisma generate` avant d'accuser quoi que ce soit.

## Tests

Dans `tests/`, base et SDK externes simulés (`vi.mock`) — donc exécutables en CI, où ils tournent
à chaque PR avec le lint, les types et le build. Ils couvrent ce qui fait mal : autorisation,
webhook Stripe, suppression de compte, tri IA, projection calendrier, rappels.

Les fichiers de test utilisent des **imports statiques** : `vi.mock` est hoisté par vitest, et un
`await import()` de haut niveau fait échouer `tsc --noEmit` avec le `module` du projet.

## Architecture

```
app/            routes (kebab-case)
  api/          route handlers — n'exportent QUE des méthodes HTTP
  dashboard/
components/     PascalCase
lib/            Server Actions, db.ts, session.ts, google.ts, openai.ts, stripe.ts
prisma/         schema.prisma + migrations
tests/
```

Les rendez-vous ne sont pas une entité séparée : une note porte un `type`
(`NOTE` / `TASK` / `EVENT`), et `googleEventId` marque sa projection dans Google Calendar
(null = pas encore poussée).

## Règles du projet

Trois qui expliquent la forme du code, et qui ont chacune coûté un bug en v1 :

1. **Une Server Action est un endpoint HTTP public.** Jamais d'`userId` en argument : chaque
   action résout l'utilisateur elle-même via `getUser()`. Tout accès filtre sur `userId` **dans la
   requête** — `findFirst({ where: { id, userId } })`, jamais un `findUnique` suivi d'un test.
2. **Le Premium se relit en base**, jamais depuis la session ni depuis le client. Masquer un lien
   en CSS n'est pas un contrôle d'accès.
3. **Pas de `redirect()` dans une fonction appelée par une route API.** Il lève `NEXT_REDIRECT` ;
   attrapé par un `try/catch`, il devient un 500 alors que l'opération a réussi.

`CLAUDE.md` détaille le reste ; `ROADMAP.md` dit ce qui reste à faire.

## Latence en développement

La base est à Frankfurt. Depuis La Réunion, un aller-retour SQL coûte **~300 ms** — c'est de la
physique, pas un bug, et **ça disparaît en production** (Vercel `fra1` est à côté de Neon). Ne pas
conclure d'une lenteur locale à une lenteur en prod ; compter les allers-retours, pas les
millisecondes.

## Git

`main` = stable, `dev` = intégration. **On ne commite jamais directement sur `main`.** Chaque
tâche part d'une branche dédiée créée depuis `dev` (`fix/…`, `feat/…`, `chore/…`) et fusionne dans
`dev` par une PR. `dev → main` se fait aux jalons.
