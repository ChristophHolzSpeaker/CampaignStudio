ALTER TABLE "prompts" ALTER COLUMN "topic" SET DEFAULT '';
UPDATE "prompts" SET "topic" = '' WHERE "topic" IS NULL;
ALTER TABLE "prompts" ALTER COLUMN "topic" SET NOT NULL;
DROP INDEX IF EXISTS "prompts_unique_key";
CREATE UNIQUE INDEX "prompts_unique_key" ON "public"."prompts" ("purpose", "audience", "format", "topic");
