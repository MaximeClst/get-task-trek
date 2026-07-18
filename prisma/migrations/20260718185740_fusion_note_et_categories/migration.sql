-- Fusion de Notes et Event en un seul modele Note, discrimine par `type`.
--
-- ORDRE IMPORTANT: on cree les nouvelles tables, on RECOPIE les donnees, et
-- seulement ensuite on supprime les anciennes. Le SQL genere par Prisma faisait
-- les DROP en premier, ce qui aurait perdu le contenu existant.

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('NOTE', 'TASK', 'EVENT');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "type" "NoteType" NOT NULL DEFAULT 'NOTE',
    "title" TEXT NOT NULL,
    "content" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "googleEventId" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "classifiedByAi" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- CreateIndex
CREATE INDEX "Note_userId_type_idx" ON "Note"("userId", "type");

-- CreateIndex
CREATE INDEX "Note_startAt_reminderSentAt_idx" ON "Note"("startAt", "reminderSentAt");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des donnees: anciennes Notes -> Note de type NOTE.
--
-- On ne DEDUIT PAS le type d'apres la presence d'une date. En Free le
-- classement est manuel: inventer ici un type que l'utilisateur n'a jamais
-- choisi serait une decision produit prise par une migration. Les dates sont
-- conservees, l'utilisateur reclassera.
--
-- Notes.title etait nullable, Note.title ne l'est pas: COALESCE evite qu'une
-- ligne sans titre fasse echouer toute la migration.
INSERT INTO "Note" ("id", "type", "title", "content", "startAt", "endAt", "allDay", "completed", "userId", "createdAt", "updatedAt")
SELECT
    "id",
    'NOTE'::"NoteType",
    COALESCE(NULLIF(TRIM("title"), ''), 'Sans titre'),
    "description",
    "start",
    "end",
    false,
    "completed",
    "userId",
    "createdAt",
    "updatedAt"
FROM "Notes";

-- Reprise des donnees: anciens Event -> Note de type EVENT.
-- Ceux-la portaient bien un type explicite, on le conserve.
INSERT INTO "Note" ("id", "type", "title", "content", "startAt", "endAt", "allDay", "completed", "userId", "createdAt", "updatedAt")
SELECT
    "id",
    'EVENT'::"NoteType",
    COALESCE(NULLIF(TRIM("title"), ''), 'Sans titre'),
    "description",
    "start",
    "end",
    "allDay",
    false,
    "userId",
    "createdAt",
    "updatedAt"
FROM "Event";

-- Les donnees sont recopiees: on peut supprimer les anciennes tables.
-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_userId_fkey";

-- DropForeignKey
ALTER TABLE "Notes" DROP CONSTRAINT "Notes_userId_fkey";

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "Notes";

-- AlterTable: notesCount etait du code mort, toujours a 0. Le vrai quota est
-- compte en base par createNote.
ALTER TABLE "User" DROP COLUMN "notesCount";

-- DropEnum: Plan n'a jamais ete utilise, isPremium suffit.
DROP TYPE "Plan";
