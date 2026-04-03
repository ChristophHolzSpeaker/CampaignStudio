CREATE TABLE "prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"audience" text NOT NULL,
	"format" text NOT NULL,
	"topic" text,
	"model" text NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt_template" text NOT NULL,
	"metadata" jsonb,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "prompts_unique_key" ON "public"."prompts" ("purpose", "audience", "format", "topic");
--> statement-breakpoint
CREATE INDEX "prompts_active_idx" ON "public"."prompts" ("is_active") WHERE is_active;
