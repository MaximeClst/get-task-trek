# Task Trek

> Ce fichier prime sur `~/.claude/CLAUDE.md`. Les instructions globales décrivent un **site vitrine
> pour artisans** (Supabase, palette orange #ff6b35, Fraunces, framer-motion) : **rien de tout cela
> ne s'applique ici**. Task Trek est un SaaS, stack et design system ci-dessous.

## Produit

Task Trek transforme de la parole en notes, tâches et rendez-vous organisés.

**Boucle centrale :** l'utilisateur dicte → transcription → un item est créé → il est *classé*
(note / tâche / rendez-vous) et *catégorisé* → si c'est un rendez-vous, il part dans Google Calendar.

La différence entre les deux offres n'est **pas** la dictée : c'est **qui fait le travail de tri**.

| | Free | Premium |
|---|---|---|
| Dictée + transcription | ✅ | ✅ |
| Classement (note/tâche/RDV) | manuel | **IA** |
| Catégorisation | manuel, catégories créées à la main | **IA**, sur les catégories existantes |
| Ajout à Google Calendar | manuel | **automatique** |
| Rappels e-mail | ❌ | ✅ |

Autrement dit : en Free, l'IA n'intervient **que** pour la transcription. Tout le reste est
saisi par l'utilisateur. C'est la frontière à respecter dans le code.

> **À trancher :** y a-t-il un quota de notes en Free ? Non décidé. Ne pas inventer de limite ;
> l'ancien `notesCount` était du code mort qui restait à 0 — ne pas le ressusciter.

## Stack

- **Next.js 14**, App Router, TypeScript `strict`
- **Prisma + PostgreSQL**
- **NextAuth v4** (`@next-auth/prisma-adapter`), **provider Google uniquement**
- **Stripe** (abonnement Premium)
- **OpenAI** — Whisper pour la transcription, un modèle Claude/GPT pour le classement
- **Google Calendar API**
- **Resend** pour les e-mails
- **Vercel Cron** pour les rappels
- **Tailwind + shadcn/ui**, `next-themes` (clair/sombre), `lucide-react`

Design : on garde les tokens shadcn par défaut. Pas de palette imposée, pas de Fraunces,
pas de framer-motion.

## Règles non négociables

### 1. Autorisation — la règle qui a coulé la v1

La v1 avait 5 Server Actions exploitables en IDOR. **Une Server Action est un endpoint HTTP
public.** Aucune exception.

- **Jamais** d'`userId` en argument d'une Server Action ou lu depuis un champ de formulaire.
- Toute action/route récupère l'utilisateur **elle-même** via `getUser()`, en interne.
- Tout accès à une ressource filtre sur `userId` **dans la requête** :
  `findFirst({ where: { id, userId } })` — jamais `findUnique({ where: { id } })` suivi d'un test.

```ts
// ❌ jamais
export async function getNote(id: string) {
  return prisma.note.findUnique({ where: { id } });
}

// ✅ toujours
export async function getNote(id: string) {
  const user = await getUser();
  if (!user) throw new Error("Unauthorized");
  return prisma.note.findFirst({ where: { id, userId: user.id } });
}
```

Référence vivante : `app/api/events/[id]/route.ts` de la v1 faisait ça correctement.

### 2. Le Premium se vérifie côté serveur

Masquer un lien en CSS (`hidden`) ou rediriger côté client n'est **pas** un contrôle d'accès.
La v1 laissait un compte gratuit accéder à tout en tapant l'URL.

- `middleware.ts` protège `/dashboard/**`.
- Toute route ou action réservée au Premium **relit `isPremium` en base**. Jamais depuis la session
  ni depuis le client.
- Les endpoints IA (classement, catégorisation, push calendrier auto) sont Premium : le contrôle
  vit dans le handler, pas dans l'UI.

### 3. Pas de `redirect()` dans une fonction appelée par une route API

`redirect()` lève `NEXT_REDIRECT`. Attrapé par un `try/catch`, il devient un 500 alors que
l'opération a réussi — bug réel de la v1 sur `createNote` et `updateNote`.
Les Server Actions retournent un résultat ; c'est le composant appelant qui redirige.

### 4. `lib/db.ts` — le cache global Prisma est pour le DEV

Le singleton global existe pour survivre au hot-reload et ne pas épuiser le pool de connexions.
La v1 avait la condition **inversée**.

```ts
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 5. Suppressions en cascade

Toute relation vers `User` porte `onDelete: Cascade`. Sans ça, la suppression de compte casse
avec un `P2003` dès que l'utilisateur a une note — la v1 avait le bug, et c'est un enjeu RGPD.
Un test couvre « supprimer un compte qui a des données ».

## Modèle de données

On repart du schéma v1 (`User`, `Account`, `Session`, `VerificationToken`, `Subscription`),
avec ces changements :

- **`Account` stocke déjà `refresh_token` / `access_token` / `scope`** → c'est la source des
  credentials Google Calendar. Ne pas créer de table parallèle.
- **Fusionner `Notes` et `Event` en un seul modèle `Note`** discriminé par `type`. Un rendez-vous
  n'est pas une entité séparée : c'est une note de type `EVENT` qui a été projetée dans Google
  Calendar. `googleEventId` porte cette projection (null = pas encore poussé).
- **Nouveau modèle `Category`** (nom, couleur, `userId`). Il n'existait pas en v1 alors que la
  catégorisation est le cœur du produit.
- **Supprimer** `User.notesCount` (code mort, toujours à 0) et l'enum `Plan` (jamais utilisé,
  `isPremium` suffit).
- `Note.reminderSentAt` : rend le cron de rappels idempotent.

```prisma
enum NoteType { NOTE TASK EVENT }

model Note {
  id             String    @id @default(cuid())
  type           NoteType  @default(NOTE)
  title          String
  content        String?
  startAt        DateTime?
  endAt          DateTime?
  allDay         Boolean   @default(false)
  completed      Boolean   @default(false)
  googleEventId  String?           // projection Google Calendar
  reminderSentAt DateTime?         // idempotence du cron
  classifiedByAi Boolean   @default(false)
  category       Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  categoryId     String?
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId         String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([userId, type])
  @@index([startAt, reminderSentAt])
}
```

## Stripe — les deux bugs à ne pas refaire

Le webhook v1 perdait de l'argent dans les deux sens :

- **Gérer `customer.subscription.deleted` et `.updated`.** La v1 ne les traitait pas : après une
  résiliation, `isPremium` restait `true` à vie.
- **`upsert`, jamais `create`.** `Subscription.userId` est `@unique` ; un réabonnement violait
  la contrainte et faisait planter le webhook — le client payait sans récupérer son accès.
- **Idempotence :** Stripe rejoue ses événements. Traiter chaque `event.id` une seule fois.
- Continuer à vérifier la signature avant traitement (la v1 le faisait bien).

## Google Calendar

- Source de vérité pour les rendez-vous. `Note.googleEventId` est le lien.
- Scope `https://www.googleapis.com/auth/calendar.events`.
- ⚠️ **Scope sensible** : tant que l'app n'est pas vérifiée par Google, elle est **plafonnée à
  100 utilisateurs**. La vérification est un prérequis de lancement, à anticiper.
- Google OAuth est **obligatoire pour tous**, Free compris — c'est le seul provider.
- Les `access_token` expirent : prévoir le refresh via `refresh_token`. Un push calendrier qui
  échoue ne doit **jamais** faire perdre la note ; la note est créée d'abord, poussée ensuite.

## Rappels e-mail

Google Calendar notifie déjà pour les rendez-vous. Notre valeur ajoutée est ailleurs :
**les tâches**, qui ne vivent pas dans Google. Cron Vercel → notes `TASK` à échéance proche avec
`reminderSentAt` null → Resend → on horodate. Premium uniquement.

## IA

- **Transcription : Whisper**, pour tous (Free inclus). C'est le seul appel IA du tier gratuit.
- **Classement + catégorisation : Premium uniquement.** Une seule passe qui reçoit le transcript
  et la liste des catégories existantes de l'utilisateur, et retourne du JSON structuré
  (`type`, `title`, `content`, `categoryId | newCategoryName`, `startAt`).
- Sortie **validée par Zod** avant d'approcher la base. Un modèle qui hallucine un `categoryId`
  ne doit pas pouvoir écrire.
- **Un seul SDK.** La v1 en avait trois installés pour zéro appel. Choisir, et supprimer les autres.
- Coût : Whisper ≈ 0,006 $/min et il est sur le tier gratuit → surveiller, prévoir un garde-fou
  de durée d'enregistrement.

## Structure

```
app/            routes (kebab-case)
  api/          route handlers — n'exportent QUE des méthodes HTTP (GET/POST/…)
  dashboard/
components/     PascalCase
lib/            actions/*.ts (Server Actions), db.ts, auth.ts, google.ts, openai.ts, stripe.ts
prisma/         schema.prisma + migrations
```

**Un `route.ts` n'exporte que des méthodes HTTP.** La v1 ne buildait pas parce que
`app/api/chat/route.ts` exportait `handleCalendarRequest`. Un helper va dans `lib/`.

Ne pas recréer : `lib/createNote.ts`, `app/api/limitNote.ts` (handlers Pages Router posés dans
`app/`, jamais routés). Pas de `Math.random()` pour générer des identifiants (collisions).

## Environnement

`.env.example` est obligatoire et tenu à jour — la v1 avait 11 variables requises, zéro documentée.

```
DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
OPENAI_API_KEY,
STRIPE_KEY_SECRET, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID,
RESEND_API_KEY, CRON_SECRET
```

### Vérifier le projet

```bash
pnpm install --frozen-lockfile
npx prisma generate            # sinon: types Prisma manquants → faux TS7006
node node_modules/typescript/lib/tsc.js --noEmit   # npx tsc ne marche pas (paquet "tsc" pirate)
pnpm build
```

⚠️ **Piège vécu :** un `node_modules` corrompu produit ~40 **fausses** erreurs TypeScript
(« Property 'children' does not exist… », `TS7006`). Ce n'est pas le code. Réinstaller et
`prisma generate` avant d'accuser quoi que ce soit.

Des variables d'env bidon suffisent au build (aucune connexion DB réelle requise).
Environnement : pnpm 10.7.1, Node v23.10.0. pnpm ignore les build scripts de Prisma → d'où le
`prisma generate` manuel.

`rm -rf` est bloqué dans cet environnement : utiliser `trash`.

## Qualité

La v1 n'avait ni ESLint configuré (malgré le script `lint`), ni tests, ni Git, et gardait le
README de `create-next-app`. Le socle minimum :

- ESLint configuré et **qui passe**
- Tests sur ce qui fait mal : autorisation (un user ne lit pas les notes d'un autre), webhook
  Stripe (résiliation, réabonnement), suppression de compte avec données
- Git dès le départ, README réel
- TypeScript `strict` — la v1 était 100 % propre de ce côté, ne pas régresser
