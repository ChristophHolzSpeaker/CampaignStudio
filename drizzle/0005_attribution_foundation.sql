create table "lead_journeys" (
	"id" uuid primary key default gen_random_uuid() not null,
	"campaign_id" integer references "public"."campaigns"("id") on delete set null,
	"campaign_page_id" integer references "public"."campaign_pages"("id") on delete set null,
	"first_touch_type" text not null,
	"first_touch_at" timestamp default now() not null,
	"contact_email" text,
	"contact_name" text,
	"current_stage" text default 'new' not null,
	"hubspot_contact_id" text,
	"hubspot_deal_id" text,
	"outcome" text,
	"created_at" timestamp default now() not null,
	"updated_at" timestamp default now() not null
);

create index "lead_journeys_contact_campaign_updated_idx" on "public"."lead_journeys" using btree ("contact_email", "campaign_id", "updated_at");
create index "lead_journeys_stage_idx" on "public"."lead_journeys" using btree ("current_stage");

create table "lead_events" (
	"id" uuid primary key default gen_random_uuid() not null,
	"lead_journey_id" uuid references "public"."lead_journeys"("id") on delete set null,
	"campaign_id" integer references "public"."campaigns"("id") on delete set null,
	"campaign_page_id" integer references "public"."campaign_pages"("id") on delete set null,
	"event_type" text not null,
	"event_source" text not null,
	"event_payload" jsonb default '{}'::jsonb not null,
	"session_id" text,
	"anonymous_id" text,
	"occurred_at" timestamp default now() not null
);

create index "lead_events_journey_occurred_idx" on "public"."lead_events" using btree ("lead_journey_id", "occurred_at");
create index "lead_events_campaign_page_occurred_idx" on "public"."lead_events" using btree ("campaign_id", "campaign_page_id", "occurred_at");
create index "lead_events_session_idx" on "public"."lead_events" using btree ("session_id");
create index "lead_events_anonymous_idx" on "public"."lead_events" using btree ("anonymous_id");

create table "booking_links" (
	"id" uuid primary key default gen_random_uuid() not null,
	"lead_journey_id" uuid not null references "public"."lead_journeys"("id") on delete cascade,
	"campaign_id" integer not null references "public"."campaigns"("id") on delete cascade,
	"token" text not null,
	"expires_at" timestamp not null,
	"clicked_at" timestamp,
	"booked_at" timestamp,
	"created_at" timestamp default now() not null,
	"updated_at" timestamp default now() not null
);

create unique index "booking_links_token_key" on "public"."booking_links" using btree ("token");
create index "booking_links_expires_at_idx" on "public"."booking_links" using btree ("expires_at");
