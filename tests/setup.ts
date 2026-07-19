// Variables d'environnement bidon, posees AVANT que les modules ne se
// chargent. Le SDK Stripe refuse de s'instancier sans cle, et lib/stripe.ts
// l'instancie au chargement du module -- donc a l'import, avant tout test.
//
// Aucune de ces valeurs n'atteint un service reel: la base et Stripe sont
// simules dans chaque fichier de test.
process.env.STRIPE_KEY_SECRET ??= "sk_test_bidon";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_bidon";
process.env.STRIPE_PRICE_ID_MONTHLY ??= "price_bidon";
process.env.GOOGLE_CLIENT_ID ??= "client-bidon";
process.env.GOOGLE_CLIENT_SECRET ??= "secret-bidon";
process.env.OPENAI_API_KEY ??= "sk-bidon";
process.env.DATABASE_URL ??= "postgresql://bidon:bidon@localhost:5432/bidon";
process.env.NEXTAUTH_SECRET ??= "secret-bidon";
process.env.NEXTAUTH_URL ??= "http://localhost:3000";
