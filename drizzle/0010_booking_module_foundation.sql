create type "booking_type" as enum ('lead', 'general');
create type "booking_status" as enum ('confirmed', 'cancelled');
create type "booking_reschedule_actor" as enum ('lead', 'admin', 'system');

alter table "booking_links"
add column "booking_type" "booking_type" default 'lead' not null;

alter table "booking_links"
add column "metadata" jsonb;

alter table "booking_links"
alter column "lead_journey_id" drop not null;

alter table "booking_links"
alter column "campaign_id" drop not null;

create table "bookings" (
	"id" uuid primary key default gen_random_uuid() not null,
	"booking_type" "booking_type" not null,
	"lead_journey_id" uuid references "public"."lead_journeys"("id") on delete set null,
	"email" text not null,
	"name" text,
	"company" text,
	"scope" text not null,
	"status" "booking_status" default 'confirmed' not null,
	"starts_at" timestamp not null,
	"ends_at" timestamp not null,
	"google_calendar_event_id" text,
	"reschedule_token" text,
	"is_repeat_interaction" boolean default false not null,
	"created_at" timestamp default now() not null,
	"updated_at" timestamp default now() not null
);

create index "bookings_email_idx" on "public"."bookings" using btree ("email");
create index "bookings_lead_journey_id_idx" on "public"."bookings" using btree ("lead_journey_id");
create index "bookings_starts_at_idx" on "public"."bookings" using btree ("starts_at");
create unique index "bookings_reschedule_token_key" on "public"."bookings" using btree ("reschedule_token");

create table "booking_rules" (
	"id" uuid primary key default gen_random_uuid() not null,
	"booking_type" "booking_type" not null,
	"advance_notice_minutes" integer not null,
	"slot_duration_minutes" integer not null,
	"slot_interval_minutes" integer not null,
	"is_enabled" boolean default true not null,
	"created_at" timestamp default now() not null,
	"updated_at" timestamp default now() not null
);

create unique index "booking_rules_booking_type_key" on "public"."booking_rules" using btree ("booking_type");

create table "booking_settings" (
	"id" uuid primary key default gen_random_uuid() not null,
	"is_paused" boolean default false not null,
	"pause_message" text,
	"created_at" timestamp default now() not null,
	"updated_at" timestamp default now() not null
);

create table "booking_reschedules" (
	"id" uuid primary key default gen_random_uuid() not null,
	"booking_id" uuid not null references "public"."bookings"("id") on delete cascade,
	"old_starts_at" timestamp not null,
	"old_ends_at" timestamp not null,
	"new_starts_at" timestamp not null,
	"new_ends_at" timestamp not null,
	"changed_by" "booking_reschedule_actor" not null,
	"changed_at" timestamp default now() not null
);

create index "booking_reschedules_booking_id_idx" on "public"."booking_reschedules" using btree ("booking_id");
create index "booking_reschedules_changed_at_idx" on "public"."booking_reschedules" using btree ("changed_at");
