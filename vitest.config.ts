import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Alias declare a la main plutot qu'avec vite-tsconfig-paths: tsconfig.json
// n'a qu'UN mapping ("@/*" -> "./*"), et le plugin est ESM-only, ce qui casse
// le chargement de cette config. Une dependance et un mode de panne en moins.
//
// Si un jour tsconfig gagne d'autres chemins, il faudra les reporter ici --
// d'ou ce commentaire.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // Aucun test ne touche au DOM: ce sont des regles metier, pas des
    // composants. jsdom couterait du temps de demarrage pour rien.
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Les variables lues au chargement des modules (cle Stripe, secret du
    // webhook) doivent exister avant l'import, sinon le SDK refuse de
    // s'instancier. Valeurs bidon: aucun test n'appelle un service reel.
    setupFiles: ["tests/setup.ts"],
  },
});
