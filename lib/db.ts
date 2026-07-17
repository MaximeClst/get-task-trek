import { PrismaClient } from "@prisma/client";

// Le cache global sert au DEVELOPPEMENT, pas a la production: le hot-reload
// reevalue ce module a chaque modification de fichier, et sans cache chaque
// rechargement instancie un client de plus. Chacun rouvre une connexion (~2 s
// vers une base distante) et le pool de la base finit sature.
// En production le module n'est evalue qu'une fois: le cache y est inutile.
const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
