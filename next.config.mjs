/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next build` et `next dev` ecrivent par defaut dans le MEME dossier .next/.
  // Lancer un build de verification pendant que le serveur de dev tourne ecrase
  // les chunks qu'il est en train de servir: la page perd son CSS jusqu'au
  // prochain rechargement complet. C'est la cause du "le CSS se casse a chaque
  // modif" -- pas un bug de Tailwind.
  //
  // Vercel ne definit pas cette variable et retombe sur .next/, donc rien ne
  // change en production. En local: NEXT_DIST_DIR=.next-verify pnpm build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    domains: ["lh3.googleusercontent.com", "avatars.githubusercontent.com"],
  },
};

export default nextConfig;
