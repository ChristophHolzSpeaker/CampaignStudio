create table "mailbox_cursors" (
	"id" uuid primary key default gen_random_uuid() not null,
	"gmail_user" text not null,
	"last_processed_history_id" text not null,
	"watch_expiration" timestamp not null,
	"last_watch_renewed_at" timestamp,
	"last_push_received_at" timestamp,
	"last_sync_at" timestamp,
	"sync_status" text default 'idle' not null,
	"created_at" timestamp default now() not null,
	"updated_at" timestamp default now() not null
);

create unique index "mailbox_cursors_gmail_user_key" on "public"."mailbox_cursors" using btree ("gmail_user");

create table "lead_messages" (
	"id" uuid primary key default gen_random_uuid() not null,
	"lead_journey_id" uuid not null references "public"."lead_journeys"("id") on delete cascade,
	"direction" text not null,
	"provider" text default 'gmail' not null,
	"provider_message_id" text not null,
	"provider_thread_id" text not null,
	"from_email" text not null,
	"to_email" text not null,
	"subject" text not null,
	"body_text" text not null,
	"body_html" text,
	"classification" text,
	"classification_confidence" real,
	"auto_response_decision" text,
	"auto_response_sent_at" timestamp,
	"received_at" timestamp,
	"sent_at" timestamp,
	"raw_metadata" jsonb default '{}'::jsonb not null,
	"created_at" timestamp default now() not null,
	"updated_at" timestamp default now() not null
);

create unique index "lead_messages_provider_message_id_key" on "public"."lead_messages" using btree ("provider_message_id");
create index "lead_messages_provider_thread_id_idx" on "public"."lead_messages" using btree ("provider_thread_id");
create index "lead_messages_lead_journey_id_idx" on "public"."lead_messages" using btree ("lead_journey_id");
create index "lead_messages_received_at_idx" on "public"."lead_messages" using btree ("received_at");
create index "lead_messages_sent_at_idx" on "public"."lead_messages" using btree ("sent_at");
