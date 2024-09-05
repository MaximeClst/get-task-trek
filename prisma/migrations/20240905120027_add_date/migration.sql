-- This is an empty migration.
ALTER TABLE "Notes" ADD COLUMN "date" TIMESTAMP NOT NULL DEFAULT NOW();
