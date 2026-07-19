# Task Trek

> Ce fichier prime sur `~/.claude/CLAUDE.md`. Les instructions globales décrivent un **site vitrine
> pour artisans** (Supabase, palette orange #ff6b35, Fraunces, framer-motion) : **rien de tout cela
> ne s'applique ici**. Task Trek est un SaaS, stack et design system ci-dessous.

> **`ROADMAP.md`** liste ce qui reste à faire, par priorité, avec les décisions encore ouvertes.
> Ce fichier-ci dit *comment* construire ; la roadmap dit *quoi*, et dans quel ordre.

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

**Quota Free : 10 notes.** Il est réellement appliqué dans `createNote` (`lib/actionsNotes.ts`),
par un `count()` en base — à ne pas confondre avec le champ `User.notesCount`, qui lui est du code
mort resté à 0 et qu'il faut supprimer, pas ressusciter.

## Workflow Git

- `main` = stable. `dev` = intégration. **On ne commite jamais directement sur `main`.**
- Chaque tâche part d'une **branche dédiée créée depuis `dev`** (`fix/…`, `feat/…`, `chore/…`)
  et fusionne dans `dev` **par une PR**. `dev → main` se fait aux jalons.
- Remote : `origin` = `github.com/MaximeClst/get-task-trek` (public).
- Fins de ligne : le dépôt distant est en **LF**, la copie locale en **CRLF**. À normaliser un jour
  via `.gitattributes` (`* text=auto eol=lf`) ; sans quoi les diffs peuvent paraître énormes alors
  que seul le retour chariot change (`git diff --ignore-all-space` pour voir le vrai écart).

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

## Stripe — tarifs

**Un seul plan : Premium à 15,99 €/mois.** Un plan annuel a existé le 2026-07-17 puis a été
abandonné ; son `Price` et son produit sont archivés côté Stripe, pas supprimés (Stripe ne
supprime pas un `Price`).

État du compte (test) : un produit **« Task Trek Premium »**, un `Price` actif récurrent mensuel.

- **Un `Price` Stripe est immuable.** On ne modifie jamais un tarif : on crée un nouveau `Price`
  et on remplace l'ID dans `STRIPE_PRICE_ID_MONTHLY`. Le montant affiché en JSX n'est que du
  texte — il n'engage rien, et doit rester aligné à la main.
- **Le client n'envoie jamais de `priceId`** : le serveur le résout depuis l'environnement.
  Un `priceId` venant du navigateur laisserait n'importe qui s'abonner au tarif de son choix.
  Si un jour un choix de plan revient, faire transiter un identifiant de plan validé contre une
  liste fermée — jamais le `priceId` lui-même.
- `createSubscription` refuse un `Price` non récurrent : la session est créée en
  `mode: "subscription"`, que Stripe rejette pour un prix one-time.
- La clé et les `Price` doivent être dans le **même mode** (test/live). Sinon : « No such price »,
  sans indication de la cause.
- Un tarif ne migre jamais les abonnés existants : ils restent sur leur ancien `Price`.
- Deux prix d'une même offre vivent sur **un seul produit**, sinon le portail client ne sait pas
  proposer de changement de période et le MRR se scinde dans les rapports.

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

## Latence — la contrainte qui gouverne le reste

**L'utilisateur développe depuis La Réunion. La base Neon est à Frankfurt, à ~9 000 km.**
Un aller-retour SQL depuis sa machine coûte **~300 ms** (mesuré : un `SELECT 1` met 300 ms,
une vraie requête ~520 ms, une connexion à froid ~2,3 s). C'est de la physique, pas un bug.

Conséquences, à garder en tête pour toute décision :

- **Compter les allers-retours, pas les millisecondes.** Chaque requête séquentielle ajoute
  ~300 ms en local. Ce qui coûte 5 ms en production coûte 60× plus ici.
- `getUser()` vit dans **`lib/session.ts`** et est enveloppé dans `cache()` de React, qui le
  dédoublonne sur la durée d'une requête — le layout du dashboard et la page qu'il rend
  l'appellent tous les deux. Ne pas le réintroduire dans un fichier `"use server"` : ça
  l'exposerait comme endpoint public, et casserait la déduplication.
- **En production, ce problème disparaît** : Vercel (`fra1`) est à côté de Neon, l'aller-retour
  tombe à quelques millisecondes. Ne pas conclure d'une lenteur locale à une lenteur en prod.
- `getUser()` refait un `user.findUnique` alors que `getServerSession` a déjà chargé la ligne
  via l'adaptateur Prisma. Un aller-retour de trop, pas encore optimisé.

**Tout bouton déclenchant une action serveur doit afficher son état d'attente** — `useFormStatus`
dans un enfant du `<form>`, ou un `isSubmitting` local. Désarmer le bouton pendant l'action :
sans ça l'utilisateur reclique et crée des doublons. Et **ne jamais afficher un succès avant
d'avoir le résultat** : le bouton de suppression toastait « supprimée avec succès » sur `onClick`,
avant même l'appel, et mentait quand l'action échouait.

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

Voir **`.env.example`**, qui fait foi et doit être mis à jour à chaque nouvelle variable.
`NEXTAUTH_SECRET`, `NEXTAUTH_URL` et `DATABASE_URL` n'apparaissent pas dans le code (lues
implicitement par NextAuth et Prisma) mais sont requises — un `grep process.env` les rate.

À ajouter au fil de la v2 : `RESEND_API_KEY`, `CRON_SECRET`.

### Vérifier le projet

```bash
pnpm install --frozen-lockfile
npx prisma generate            # sinon: types Prisma manquants → faux TS7006
node node_modules/typescript/lib/tsc.js --noEmit   # npx tsc ne marche pas (paquet "tsc" pirate)
pnpm lint                                          # ESLint, doit passer
pnpm test                                          # vitest, ne touche ni la base ni le réseau
NEXT_DIST_DIR=.next-verify pnpm build              # voir ci-dessous
```

Les tests vivent dans `tests/`, la base et les SDK externes y sont simulés (`vi.mock`). Ils
couvrent ce qui fait mal : autorisation, webhook Stripe, suppression de compte, tri IA,
projection calendrier. **Un test qui exige un vrai service n'a pas sa place là** — il ne
passerait pas en CI, et on finirait par le désactiver.

⚠️ Les fichiers de test doivent utiliser des **imports statiques**, pas `await import()` :
`vi.mock` est hoisté par vitest, et un `await` de haut niveau fait échouer `tsc --noEmit`
avec le `module` du projet.

⚠️ **Ne jamais lancer `pnpm build` nu pendant que `next dev` tourne.** Les deux écrivent dans
`.next/` : le build écrase les chunks servis par le serveur de dev, et **la page perd son CSS**
jusqu'au prochain rechargement complet. Le symptôme ressemble à un bug Tailwind, n'en est pas.
D'où `NEXT_DIST_DIR`, qui isole les builds de vérification (`next.config.mjs`). Vercel ne définit
pas cette variable et retombe sur `.next/`.

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
