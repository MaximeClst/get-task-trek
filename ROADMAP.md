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
- [x] **Plafonner Whisper au tier gratuit — fait**, voir §2.2. Trois garde-fous empilés : durée
  d'enregistrement (2 min), débit (20 dictées/h), et surtout un **plafond mensuel en secondes
  réelles** facturées par OpenAI (Free 30 min, Premium 10 h). Reste vrai : le multi-compte Google
  ne se bloque pas, donc le plafond protège le compte, pas la personne.

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

- [x] **Scope `calendar.events` ajouté (PR `feat/google-calendar`)**, avec
  `access_type: "offline"` (sans quoi Google ne délivre **aucun** `refresh_token`) et
  `prompt: "consent"` (sans quoi seuls les *futurs* inscrits en recevraient un — Google ne le
  renvoie qu'au tout premier consentement). Coût assumé : un écran d'autorisation à chaque
  connexion.
  **Piège corrigé au passage :** NextAuth v4 ne met **pas** à jour un `Account` déjà lié — à la
  reconnexion il trouve le compte et ouvre la session sans réécrire les tokens. Le nouveau
  `scope` aurait été jeté. Un callback `signIn` les réécrit.
- [x] **Refresh des tokens (PR `feat/google-calendar`).** `lib/google.ts`, sans SDK : le paquet
  `googleapis` pèse ~50 Mo pour trois endpoints REST. Rafraîchissement avec marge de 60 s,
  persistance immédiate, et un `refresh_token` existant n'est **jamais** écrasé par un
  `undefined` (Google n'en renvoie pas systématiquement — le perdre couperait l'accès sans retour
  possible). Credentials lus depuis `Account`, pas de table parallèle.
- [x] **Push des rendez-vous (PR `feat/google-calendar`).** La note est écrite **d'abord**, poussée
  ensuite, et `pousserSiPremium` avale ses erreurs : un agenda indisponible ne coûte jamais sa
  note à l'utilisateur. Push automatique en Premium, bouton manuel pour tous (la frontière porte
  sur l'automatisation, pas sur la fonctionnalité). Idempotent : rappelé sur une note déjà
  poussée, il met à jour au lieu de créer un doublon. Suppression et renommage d'un rendez-vous
  sont répercutés dans l'agenda.
  **Le bug qui ne se voit qu'à l'usage :** sur un événement « toute la journée », la date de fin
  de Google est **exclusive**, alors que notre `endAt` vaut 23:59 le même jour. Recopiée telle
  quelle, elle produisait un événement de durée nulle, absent de l'agenda. Couvert par des tests.
- [ ] **Restant : activer le scope dans la Google Cloud Console.** Le code le demande, mais tant
  que `calendar.events` n'est pas déclaré sur l'écran de consentement OAuth, Google refusera.
  Étape manuelle, à faire avant de tester.
- [ ] **Restant : vérification bout-en-bout** avec un vrai compte Google et un vrai agenda.

### 2.6 Rappels e-mail (Premium)

- [x] **Fait (PR `feat/rappels-email`).** Cron Vercel horaire → `/api/cron/rappels` → tâches
  `TASK` à échéance dans les 24 h, `reminderSentAt` null, non terminées, compte Premium (lu
  **en base**) → Resend → horodatage.
  **Les rendez-vous sont volontairement exclus** : Google Agenda les notifie déjà, un rappel
  serait un doublon — donc une raison de se désabonner. La valeur ajoutée est sur les tâches,
  qui ne vivent nulle part ailleurs.
  **L'ordre réservation → envoi** ferme la fenêtre où deux exécutions simultanées enverraient
  le même e-mail : `updateMany({ where: { id, reminderSentAt: null } })` fait que seule la
  première voit `count === 1`. Un envoi raté relâche la réservation et repart au tour suivant.
  Fenêtre bornée des **deux** côtés, sans quoi la première exécution rappellerait toutes les
  tâches en retard depuis des mois. Plafond de 100 par exécution pour tenir dans `maxDuration`.
  Endpoint protégé par `CRON_SECRET` ; **absence de secret = 503**, pas d'endpoint ouvert.
  14 tests.
- [ ] **Restant : variables d'environnement et domaine Resend.** `RESEND_API_KEY`, `CRON_SECRET`
  et `RESEND_FROM` à créer (dans `.env`, `.env.example` et Vercel), et le domaine d'envoi à
  vérifier chez Resend — sans quoi chaque envoi échoue en « Domain not verified ».
- [ ] **Vérifier la fréquence de cron réellement appliquée par Vercel.** `vercel.json` demande
  `"0 * * * *"` (horaire), mais le plan **Hobby** restreint les crons — vraisemblablement à un
  déclenchement **quotidien**. Non confirmé dans la doc : après un deploy en production,
  `vercel crons ls` donne le planning réel. Si l'horaire ne passe pas, l'endpoint n'est qu'un
  `GET` protégé par `Authorization: Bearer $CRON_SECRET` — **rien ne nous lie à Vercel Cron**,
  un workflow `schedule` GitHub Actions (déjà en place pour la CI, gratuit) fait le même travail.
- [x] **Question tranchée le 2026-07-20 : les rappels e-mail font-ils doublon avec Google ?**
  Non. Seuls les `EVENT` sont poussés dans Google (`calendrierAuto.ts` sort tôt sur tout autre
  type) : une **tâche ne quitte jamais Task Trek**, donc Google ne peut pas la rappeler. C'est
  précisément le trou que l'e-mail comble, et la seule chose de la boucle que Google ne fait pas
  gratuitement à notre place.
  Reste ouvert, mais non retenu pour l'instant : pousser aussi les **tâches** vers Google. Ça
  rendrait l'e-mail inutile, mais une tâche n'est pas un créneau — la projeter en événement
  salirait l'agenda, et le bon réceptacle (Google Tasks) est une autre API et un autre scope.

---

## 3. Avant le lancement public

- [ ] **Vérification Google OAuth.** `calendar.events` est un scope **sensible** : tant que
  l'app n'est pas vérifiée, elle est **plafonnée à 100 utilisateurs**. Le dossier prend des
  semaines — à lancer bien avant l'ouverture.
- [ ] **Stripe en live.** Les `Price` actuels sont en test. Créer les `Price` live (nouveaux
  IDs), un endpoint webhook de production (nouveau `whsec_`), et vérifier que clé et prix sont
  dans le **même mode**.
- [ ] **Aucun endpoint webhook n'est enregistré chez Stripe, même en test** (constaté le
  2026-07-19 : `GET /v1/webhook_endpoints` renvoie une liste vide). Les événements traités
  jusqu'ici venaient tous d'une session `stripe listen` du CLI. Conséquence vécue : un paiement
  réel n'a jamais activé le Premium, et l'utilisateur a repayé — **deux abonnements actifs sur
  le même client**. La page de retour de paiement réconcilie désormais avec Stripe
  (PR `fix/abonnement-non-synchronise`), mais ça reste un filet, pas le chemin normal.
  **En développement**, le webhook n'arrive que si `stripe listen --forward-to
  localhost:3000/api/webhook/stripe` tourne, ET que `STRIPE_WEBHOOK_SECRET` vaut le `whsec_`
  imprimé par cette commande — sinon la signature est rejetée en 400.
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
- [x] **`User.notesCount` et l'enum `Plan` supprimés** — emportés par la migration de fusion
  `Notes`/`Event` (§2.1), comme prévu. Plus aucune trace ni au schéma ni au code.
- [x] **`event-utils.ts` supprimé** avec l'assistant factice (PR `chore/supprime-faux-assistant`).
  Le `Math.random()` sur 1M identifiants est parti avec. Plus aucun `Math.random()` dans le code.
- [ ] **`getUser()` fait un aller-retour de trop** : `getServerSession` a déjà chargé la ligne
  utilisateur via l'adaptateur Prisma, et `getUser` refait un `findUnique`.
  **Décidé le 2026-07-20 : on ne touche pas, on verra avec de vrais utilisateurs en test.**
  Deux raisons. Le gain est du **confort de dev uniquement** — en production Vercel `fra1` est à
  côté de Neon, l'aller-retour coûte quelques millisecondes. Et le prix est un couplage tacite :
  réutiliser la ligne chargée par l'adaptateur rendrait la fraîcheur d'`isPremium` dépendante du
  fait qu'on reste en **sessions base**. Le jour où quelqu'un passe en `strategy: "jwt"` (envisagé
  au §1 pour Next 15), `isPremium` redeviendrait une valeur figée dans le cookie **partout et en
  silence** — le bug que `fix/premium-serveur` a corrigé. Si on le fait un jour, l'accompagner
  d'un test qui échoue explicitement quand la stratégie de session change.
- [x] **ESLint configuré et qui passe (PR `chore/eslint-vitest`).** `eslint` + `eslint-config-next`
  installés (ils ne l'étaient pas, malgré le script `lint`), `.eslintrc.json` sur
  `next/core-web-vitals`. Une seule erreur réelle dans tout le code, corrigée.
- [x] **Tests — 51 tests, 5 fichiers (PR `chore/eslint-vitest`).** vitest, base et SDK externes
  simulés : ni réseau ni base, donc exécutables en CI.
  - **autorisation** : le `userId` est dans le `WHERE`, pas dans un test après coup ; message
    identique pour une note inexistante et celle d'un autre ; `categoryId` d'autrui refusé ;
    quota de 10 notes ; un compte gratuit ne peut pas se déclarer trié par l'IA.
  - **webhook Stripe** : la résiliation retire bien `isPremium` (le bug v1), `upsert` et non
    `create` au réabonnement, écriture en une seule transaction.
  - **suppression de compte** : un seul `delete`, aucune table vidée à la main — c'est la liste
    manuelle qui *était* le bug.
  - **tri IA** : `categoryId` d'un autre compte ignoré, fuseaux horaires, troncature du titre.
  - **calendrier** : la date de fin exclusive d'un événement « toute la journée ».
  Choix : vitest plutôt que `node:test` pour `vi.mock`, sans lequel on ne peut pas simuler Prisma.
- [x] **CI branchée (PR `chore/ci`)** — `.github/workflows/ci.yml` lance lint, types, tests et
  build à chaque PR.
- [x] **README réel (PR `chore/menage-dette`).** Celui de `create-next-app` remplacé : produit,
  frontière Free/Premium, démarrage, procédure de vérification, et les pièges qui coûtent une
  demi-heure quand on ne les connaît pas (`npx tsc` pirate, build nu pendant `next dev`,
  `node_modules` corrompu).
- [x] **`getStripeSession` dédupliqué (PR `chore/menage-dette`).** Il en existait **deux**, et
  elles avaient déjà divergé : celle de `lib/stripe.ts`, exportée mais importée par personne,
  posait `billing_address_collection` et `customer_update` ; celle d'`actionsStripe.ts`, privée,
  faisait le travail sans. Deux définitions d'un appel facturable qui s'écartent en silence.
  La version **effectivement utilisée** est conservée telle quelle et remontée dans `lib/stripe.ts`
  — aucun changement de comportement au checkout. Le `as string` sur `session.url` (qui peut être
  `null`) tombe au passage : le type dit `string | null`, l'appelant vérifiait déjà.
  **Question ouverte, volontairement non tranchée ici :** faut-il *réellement* collecter l'adresse
  de facturation ? C'est un arbitrage produit (TVA UE), pas un ménage — à décider à part.

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
