# Task Trek — ce qu'il reste à faire

État au **2026-07-17**. Le produit décrit dans `CLAUDE.md` n'existe pas encore : ce qui tourne
aujourd'hui est un gestionnaire de notes manuel avec un faux assistant. Tout le cœur — dicter,
classer, catégoriser, planifier — est à écrire.

Ordre : les blocages d'abord, le produit ensuite, le lancement en dernier.

---

## 0. Décisions à prendre (bloquent la suite)

- [x] **Modèle Free/Premium — tranché le 2026-07-17.** L'axe est **l'automatisation**, avec un
  **plafond de volume sur le Free** :
  - **Free** : dictée + transcription, puis **tri manuel** (l'utilisateur classe et catégorise
    lui-même), **plafonné à 10 notes/transcriptions**.
  - **Premium** : dictée + transcription, puis **l'IA trie** (classe, catégorise, pousse au
    calendrier), **sans plafond**, + rappels e-mail.

  Concrètement dans le code : le plafond de 10 est un `count()` en base dans `createNote`
  (déjà en place). Le tri IA et le calendrier auto se branchent derrière `isPremium`.
- [ ] **Rappels e-mail : quelle valeur ajoutée ?** Google Agenda notifie déjà pour les
  rendez-vous. L'intérêt réel est sur les **tâches**, qui ne vivent pas dans Google.
- [ ] **Postgres local pour le dev ?** ~300 ms par aller-retour vers Frankfurt depuis La Réunion.
  Un Postgres local (~1 ms) rendrait le développement confortable, Neon restant pour la prod.

---

## 1. Sécurité et facturation — à faire avant tout déploiement

- [x] **Le premium n'est que cosmétique — corrigé (PR `fix/premium-serveur`).** Garde serveur
  `requirePremium()` dans `lib/session.ts` qui relit `isPremium` **en base**. `/dashboard/calendar`
  et `/dashboard/assistant` deviennent des Server Components qui redirigent un compte gratuit vers
  `/dashboard/payment` avant tout rendu ; `/api/events` renvoie 403. Vérifié : gratuit → 307/403,
  premium → 200, et **une session premium périmée (isPremium=false en base) est bloquée sans
  reconnexion**.
- [x] **Webhook Stripe — résiliation, réabonnement, idempotence.** Corrigés et vérifiés
  bout-en-bout avec de vrais événements Stripe (commit `85f6722`). Handlers `deleted`/`updated`
  ajoutés (le statut Stripe fait foi), `create` remplacé par `upsert` sur `userId`, table
  `ProcessedWebhookEvent` pour l'idempotence.
- [x] **`middleware.ts` ajouté (PR `feat/middleware-dashboard`)** — avec une limite à connaître.
  Les sessions sont **en base** (`PrismaAdapter` sans `strategy: "jwt"`) : le cookie ne porte
  qu'un identifiant opaque, pas un JWT signé. Le middleware, sur l'Edge, ne peut donc ni le
  vérifier (`withAuth`/`getToken` déchiffrent un JWT — ils rejetteraient *tout le monde*) ni lire
  la base. Il ne fait que **constater la présence d'un cookie** : ça coupe le trafic anonyme avant
  l'aller-retour Frankfurt, mais **ça ne valide rien**.

  Au passage : la prémisse « un oubli de `getUser()` ouvre la page » était fausse — le
  `layout.tsx` du dashboard appelle `getUser()` et couvre déjà toutes les pages enfants.
  L'autorisation réelle reste dans les pages et les actions, comme avant.
- [ ] **Validation de session dans le middleware.** Le seul moyen propre serait Next 15.2+, dont
  le middleware peut tourner en runtime Node (donc lire la base). Passer aux sessions JWT ferait
  l'affaire techniquement mais réintroduirait un `isPremium` figé dans le cookie — exactement le
  bug que la PR `fix/premium-serveur` vient de corriger. À revoir lors du passage à Next 15.
- [x] **Suppression de compte (RGPD) — corrigée (PR `fix/suppression-compte-rgpd`).**
  `onDelete: Cascade` ajouté sur `Notes`, `Event` et `Subscription` (migration
  `20260718074152_cascade_delete_user_data`, qui ne touche que les contraintes, aucune donnée).
  `deleteUser()` énumérait les tables à vider à la main et en oubliait deux : la liste manuelle
  *était* le bug, elle est remplacée par un unique `user.delete()`. Vérifié sur la base avec un
  compte jetable portant note + rendez-vous + abonnement + compte OAuth + session : suppression
  sans `P2003`, zéro ligne orpheline.
- [x] **`lib/rateLimiter.ts` supprimé**, et `express-rate-limit` désinstallé. Importé nulle part,
  et incompatible avec l'App Router de toute façon.
- [x] **Contournement du quota Free — corrigé (PR `fix/limites-saisie`).** `addNoteToCalendar`
  créait une note **sans vérifier le plafond de 10**, n'était appelée par aucun code, mais était
  exportée d'un fichier `"use server"` — donc joignable en HTTP. Supprimée. `createNote` reste le
  seul chemin d'écriture, et il compte.
- [x] **Limites de taille des saisies (PR `fix/limites-saisie`).** Aucune n'existait : le quota
  compte des *lignes*, pas des *octets*, donc dix notes suffisaient à stocker des gigaoctets.
  Validation Zod côté serveur dans `lib/validationNotes.ts` (titre 200, description 10 000,
  dates réelles), `maxLength` côté formulaire pour l'affichage seulement.
- [x] **Limitation de débit — faite (PR `feat/limitation-debit`).** `lib/rateLimit.ts`, adossé à
  Postgres (table `RateLimit`, fenêtre fixe, `INSERT … ON CONFLICT` atomique en un seul
  aller-retour). Pas de service externe, pas de variable d'environnement en plus.
  **Branché sur trois endpoints**, pas seulement écrit : `createNote` (30/min), `/api/events` POST
  (30/min, vrai `429` + `Retry-After`), `createSubscription` (5/min — chaque appel déclenche deux
  appels facturables à l'API Stripe).
  Vérifié sur la base, dont le cas qui fait la différence : **20 requêtes simultanées, exactement
  5 passent**. Un limiteur qui lit puis écrit échouerait ici.
  Choix assumé : **fail-open** si le limiteur lui-même tombe (voir commentaire dans le fichier).
- [ ] **Plafonner Whisper au tier gratuit.** Le point ci-dessus pose la mécanique ; il reste à
  l'appliquer à la transcription quand elle existera, avec en plus un **garde-fou de durée
  d'enregistrement**. C'est le seul appel IA du tier gratuit, donc le seul coût variable qu'un
  compte gratuit peut nous faire payer — et le multi-compte Google ne se bloque pas (§4).

---

## 2. Le produit — tout le cœur est à écrire

### 2.1 Fondations

- [x] **Modèle de données — fusion faite (PR `feat/fusion-note-modele`).** `Notes` + `Event` →
  un seul `Note` discriminé par `type`, avec `googleEventId`, `reminderSentAt`, `classifiedByAi`.
  `Category` créé (`@@unique([userId, name])` pour que l'IA ne recrée pas dix fois « Courses » ;
  `onDelete: SetNull` pour qu'effacer une catégorie ne détruise pas les notes).
  `User.notesCount` et l'enum `Plan` supprimés.
  **Migration écrite à la main** : le SQL généré par Prisma faisait les `DROP` avant les `CREATE`
  et aurait perdu les données. Ordre corrigé, reprise vérifiée.
  Le classement manuel (Free) est branché : sélecteur de type à la création et à l'édition.
- [x] **Catégories : CRUD manuel fait (PR `feat/crud-categories`).** Page `/dashboard/categories`
  (créer, renommer, recolorier, supprimer) + affectation sur chaque note à la création et à
  l'édition. Gratuit — c'est le Premium qui automatise l'attribution, pas l'existence.
  **Le point qui comptait :** un `categoryId` venant du navigateur peut désigner la catégorie
  d'un autre compte ; la clé étrangère ne vérifie que l'existence, pas le propriétaire.
  `resolveCategoryId()` valide l'appartenance avant toute écriture. Vérifié.
- [x] **Assistant factice supprimé (PR `chore/supprime-faux-assistant`).** 420 lignes retirées :
  le « chat » n'appelait jamais de modèle, postait vers `/api/create-event` et `/api/calendar`
  (inexistantes) et son `useChat()` visait `/api/chat`, supprimée depuis. L'écran était cassé de
  bout en bout. `/dashboard/assistant` porte désormais un placeholder, en attendant Treky.
- [x] **Un seul SDK IA.** `ai`, `openai-edge` et `@ai-sdk/openai` désinstallés. Reste `openai`,
  le SDK officiel, seul utilisé (`lib/openai.ts`).

### 2.1 bis — Treky, l'assistant réel

L'assistant s'appelle **Treky**, et ce n'est **pas un chat** : c'est la boucle centrale du
produit — dicter → transcrire → classer. Un chat multiplierait les appels facturés sans rien
ajouter au tri.

- [x] **Écran de dictée fait (PR `feat/treky-dictee`).** `/dashboard/treky` : enregistrement,
  minuterie avec arrêt automatique à 2 min, transcription Whisper, relecture, puis création de la
  note. **Ouvert à tous, Free inclus** — l'ancienne page `/dashboard/assistant` était gardée par
  `requirePremium()`, ce qui n'était plus correct : la transcription est le seul appel IA du tier
  gratuit. La garde Premium se déplace sur le tri, pas sur la dictée.
  Vérifié bout en bout, y compris un vrai appel Whisper.

### 2.2 Dictée

- [x] **Enregistrement audio** dans le navigateur — `MediaRecorder`, format négocié selon le
  navigateur (webm sur Chrome/Firefox, mp4 sur Safari), micro relâché au démontage.
- [x] **Transcription Whisper** — `/api/transcribe`, ouverte à tous. Garde-fous en place :
  arrêt automatique à **2 min**, plafond serveur de **8 Mo**, types MIME sur liste fermée, et
  **20 dictées/heure** par compte (~0,24 $/h au pire). La limite de durée côté client n'est pas
  une limite : la route est publique, tout est revérifié côté serveur.
- [x] **Plafond mensuel de transcription (PR `feat/plafond-transcription`).** En **secondes
  réelles**, pas en nombre d'appels : la durée vient de Whisper (`verbose_json`), donc de ce
  qu'OpenAI facture — une durée annoncée par le navigateur serait déclarative.
  **Free 30 min/mois** (~0,18 $), **Premium 10 h/mois** (~3,60 $ contre 15,99 € encaissés).
  Ces deux nombres sont un arbitrage produit, pas une contrainte technique : ils se changent sur
  une ligne dans `lib/quotaTranscription.ts`.
  `isPremium` relu **en base**. Le refus tombe **avant** l'appel OpenAI (vérifié : 429 sans
  aucune requête sortante). Dépassement possible borné à un enregistrement (2 min max), assumé.
  Restant affiché en permanence dans l'écran Treky.

### 2.3 Tri (Premium)

- [x] **Classement + catégorisation en une passe (PR `feat/tri-ia`).** `trierTranscript`
  (`lib/actionsTri.ts`) : une passe `gpt-4o-mini`, entrée = transcript + catégories de
  l'utilisateur, sortie = JSON structuré (`type`, `title`, `content`,
  `categoryId | newCategoryName`, `startAt`). Contrainte à la source par un **JSON Schema
  `strict`** côté OpenAI, revalidée par Zod à l'arrivée.
  `isPremium` relu **en base**, jamais depuis la session. Un échec de tri ne fait **jamais**
  perdre la transcription : on retombe sur le classement manuel, texte déjà saisi.
  **L'action n'écrit rien** : elle propose un remplissage, `createNote` reste le seul chemin
  d'écriture (donc le seul qui compte le quota de 10).
- [x] **Validation Zod de la sortie (PR `feat/tri-ia`).** Le point qui comptait n'est pas la
  forme mais l'**appartenance** : un `categoryId` bien formé peut désigner la catégorie d'un
  autre compte. `resoudreCategorie()` (`lib/validationTri.ts`) vérifie l'identifiant contre la
  liste qu'on vient de lire pour cet utilisateur — déjà en mémoire, donc **sans aller-retour
  supplémentaire** vers Frankfurt. Un identifiant inconnu retombe sur « sans catégorie » plutôt
  que de faire échouer le tri.
  Prompt et résolution de catégorie vivent dans `lib/validationTri.ts`, pas dans le fichier
  `"use server"` : ce dernier ne peut exporter que des Server Actions, ce qui les rendrait
  intestables.
  Vérifié : 14 cas de logique pure (fuseaux, troncature, `type` hors enum, `categoryId` d'un
  autre compte) **plus 4 vrais appels au modèle** — « rendez-vous chez le dentiste demain à
  quatorze heures trente » → `EVENT` daté au 24/07 14:30, dans le bon fuseau.

### 2.4 Catégories manuelles (Free)

- [x] CRUD des catégories, et affectation à la main sur chaque note. Fait — voir §2.1.

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

- [x] **Deux lockfiles — réglé (PR `chore/un-seul-lockfile`).** `package-lock.json` supprimé,
  `pnpm-lock.yaml` fait foi. Le premier était **périmé** : figé au commit initial, il annonçait
  encore `@types/node@20.14.11`. Un build qui l'aurait choisi aurait installé un arbre de
  dépendances désaccordé de `package.json` (voire échoué sur `npm ci`, qui exige la synchro).
  Vérifié : `node_modules` supprimé puis `pnpm install --frozen-lockfile`, `tsc --noEmit` et
  `pnpm build` repassent.
- [x] **Code mort — `lib/createNote.ts` et `app/api/limitNote.ts` supprimés** (PR
  `fix/limites-saisie`). Handlers Pages Router jamais routés, mais qui portaient une logique de
  quota **concurrente** fondée sur `notesCount`.
- [ ] **`User.notesCount` et l'enum `Plan`** restent à supprimer (migration). `notesCount` n'a
  plus aucun lecteur depuis la suppression ci-dessus. À faire avec la fusion `Notes`/`Event`,
  pour ne pas multiplier les migrations sur des tables destinées à changer.
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
