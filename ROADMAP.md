# Task Trek — ce qu'il reste à faire

État au **2026-07-17**. Le produit décrit dans `CLAUDE.md` n'existe pas encore : ce qui tourne
aujourd'hui est un gestionnaire de notes manuel avec un faux assistant. Tout le cœur — dicter,
classer, catégoriser, planifier — est à écrire.

Ordre : les blocages d'abord, le produit ensuite, le lancement en dernier.

---

## 0. Décisions à prendre (bloquent la suite)

- [ ] **Quel modèle Free/Premium ?** Deux versions coexistent aujourd'hui et se contredisent :
  - `CLAUDE.md` : Free = dictée + tri **manuel** · Premium = l'**IA** trie
  - `/dashboard/payment` + le code : Free = **10 notes** · Premium = notes illimitées + calendrier + assistant

  L'un vend l'automatisation, l'autre le volume. Trancher **avant** d'écrire l'IA : ce choix
  décide de quoi se branche derrière le paywall.
- [ ] **Rappels e-mail : quelle valeur ajoutée ?** Google Agenda notifie déjà pour les
  rendez-vous. L'intérêt réel est sur les **tâches**, qui ne vivent pas dans Google.
- [ ] **Postgres local pour le dev ?** ~300 ms par aller-retour vers Frankfurt depuis La Réunion.
  Un Postgres local (~1 ms) rendrait le développement confortable, Neon restant pour la prod.

---

## 1. Sécurité et facturation — à faire avant tout déploiement

- [ ] **Le premium n'est que cosmétique.** Un compte gratuit accède à tout en tapant l'URL :
  - `DashboardNav.tsx:42` masque les liens en CSS (`hidden`)
  - `calendar/page.tsx:15` redirige **côté client** (contournable)
  - `/dashboard/assistant` n'a **aucun** contrôle
  - `/api/events` vérifie la session mais **jamais `isPremium`**

  → Relire `isPremium` **en base**, dans chaque handler concerné. Jamais depuis la session ni le client.
- [ ] **Webhook Stripe — résiliation jamais traitée.** Pas de handler
  `customer.subscription.deleted` ni `.updated` : après résiliation, `isPremium` reste `true`
  **à vie**. Accès premium gratuit et illimité.
- [ ] **Webhook Stripe — le réabonnement plante.** `Subscription.userId` est `@unique` et le
  webhook fait un `create` : un client qui se réabonne déclenche une violation de contrainte.
  **Il paie sans récupérer son accès.** Un `upsert` règle les deux cas.
- [ ] **Webhook Stripe — aucune idempotence**, alors que Stripe rejoue ses événements. Traiter
  chaque `event.id` une seule fois.
- [ ] **`middleware.ts` absent.** `/dashboard/**` n'est protégé que par le `getUser()` de chaque
  page : un oubli d'appel ouvre la page. À centraliser.
- [ ] **Suppression de compte cassée (RGPD).** `deleteUser()` ne supprime ni les `Notes` ni les
  `Event`, qui n'ont pas de `onDelete: Cascade` → erreur Prisma `P2003`. Tout utilisateur ayant
  au moins une note **ne peut pas supprimer son compte**.
- [ ] **`lib/rateLimiter.ts`** n'est importé nulle part, et `express-rate-limit` est de toute
  façon incompatible avec l'App Router. Supprimer, ou remplacer par une vraie solution.

---

## 2. Le produit — tout le cœur est à écrire

### 2.1 Fondations

- [ ] **Modèle de données.** Fusionner `Notes` et `Event` en un `Note` discriminé par
  `type` (`NOTE` / `TASK` / `EVENT`), avec `googleEventId` pour la projection Google. Ajouter
  `Category` (n'existe pas, alors que la catégorisation est le cœur du produit). Schéma cible
  dans `CLAUDE.md`.
- [ ] **Supprimer l'assistant factice.** Le « chat » est un arbre de `if` + regex qui n'appelle
  **jamais** OpenAI. `handleCalendarRequest` existe en **trois** copies (`CalendarHandler.tsx:5`,
  `NoteHandler.tsx:73`). `NoteHandler.tsx:90` appelle `/api/calendar` et `CalendarHandler.tsx:46`
  appelle `/api/create-event` — **ces routes n'existent pas**. `ChatWindow.tsx` utilise
  `useChat()` alors que `/api/chat` a été supprimée.
- [ ] **Un seul SDK IA.** Trois installés (`openai`, `openai-edge`, `@ai-sdk/openai`) pour zéro
  appel. Choisir, désinstaller les autres.

### 2.2 Dictée

- [ ] **Enregistrement audio** dans le navigateur.
- [ ] **Transcription Whisper** — pour tous, Free inclus. Seul appel IA du tier gratuit,
  donc **il te coûte de l'argent** (~0,006 $/min) : prévoir un garde-fou de durée.

### 2.3 Tri (Premium)

- [ ] **Classement + catégorisation en une passe.** Entrée : le transcript + les catégories
  existantes de l'utilisateur. Sortie : JSON structuré (`type`, `title`, `content`,
  `categoryId | newCategoryName`, `startAt`).
- [ ] **Validation Zod de la sortie** avant toute écriture en base. Un modèle qui hallucine un
  `categoryId` ne doit pas pouvoir écrire.

### 2.4 Catégories manuelles (Free)

- [ ] CRUD des catégories, et affectation à la main sur chaque note.

### 2.5 Google Calendar

- [ ] **Scope `calendar.events`** à ajouter au provider Google.
- [ ] **Refresh des tokens** : les `access_token` expirent. Les credentials sont déjà dans le
  modèle `Account` (`refresh_token`, `access_token`, `scope`) — ne pas créer de table parallèle.
- [ ] **Push des rendez-vous.** Un échec de push ne doit **jamais** faire perdre la note : créer
  la note d'abord, pousser ensuite.

### 2.6 Rappels e-mail (Premium)

- [ ] Cron Vercel → tâches à échéance proche avec `reminderSentAt` null → Resend → horodater.
  `CRON_SECRET` et `RESEND_API_KEY` à ajouter.

---

## 3. Avant le lancement public

- [ ] **Vérification Google OAuth.** `calendar.events` est un scope **sensible** : tant que
  l'app n'est pas vérifiée, elle est **plafonnée à 100 utilisateurs**. Le dossier prend des
  semaines — à lancer bien avant l'ouverture.
- [ ] **Stripe en live.** Les `Price` actuels sont en test. Créer les `Price` live (nouveaux
  IDs), un endpoint webhook de production (nouveau `whsec_`), et vérifier que clé et prix sont
  dans le **même mode**.
- [ ] **Nettoyer l'environnement Vercel.** Il date de 717 jours et ne déploiera rien de
  fonctionnel : `DATABASE_URL` pointe sur l'Aiven **supprimée** (DNS mort), `GITHUB_ID`/`SECRET`
  et `STRIPE_API_ID` n'existent plus dans le code. Ajouter les nouvelles variables.
- [ ] **Cohérence de langue.** La landing est en français, `/dashboard/payment` en anglais
  (« Find the ideal package », « Grab it »).

---

## 4. Dette et ménage

- [ ] **Deux lockfiles** : `package-lock.json` **et** `pnpm-lock.yaml`. npm et pnpm ont tourné
  tous les deux — c'est très probablement l'origine du `node_modules` corrompu qui produisait
  ~40 fausses erreurs TypeScript. En choisir un, supprimer l'autre.
- [ ] **Code mort** : `lib/createNote.ts` et `app/api/limitNote.ts` sont des handlers **Pages
  Router** posés dans `app/`, jamais routés. `User.notesCount` reste à 0 (le vrai quota est
  compté en base). L'enum `Plan` n'est jamais utilisé.
- [ ] **`event-utils.ts`** génère des identifiants avec `Math.random()` sur 1M → collisions.
- [ ] **`getUser()` fait un aller-retour de trop** : `getServerSession` a déjà chargé la ligne
  utilisateur via l'adaptateur Prisma, et `getUser` refait un `findUnique`.
- [ ] **ESLint** : le script `lint` existe, la config non.
- [ ] **Tests** sur ce qui fait mal : autorisation (un user ne lit pas les notes d'un autre),
  webhook Stripe (résiliation, réabonnement), suppression de compte avec données.
- [ ] **README** : encore celui de `create-next-app`.
- [ ] **`getStripeSession` dupliqué** : `lib/stripe.ts` en exporte une version que personne
  n'utilise, `lib/actionsStripe.ts` a la sienne en privé.

---

## Déjà fait (2026-07-17)

- Projet sous Git, `.gitignore` et `.env.example` (le projet n'était pas versionné)
- Build réparé — `app/api/chat/route.ts` exportait `handleCalendarRequest`
- Google seul provider, GitHub retiré
- Vraie landing + `/login` séparé (la racine était un écran de connexion déguisé)
- Tarif unique Premium 15,99 €/mois ; produit Stripe renommé (il s'appelait « Mensuel **Tast** Trek »)
- **Les 5 IDOR corrigés**, vérifiés sur la base avec deux utilisateurs réels
- Temps de réponse des boutons divisé par 3 (4579 → 1425 ms) + états d'attente
- Base Neon en place, 11 migrations appliquées, connexion Google validée
