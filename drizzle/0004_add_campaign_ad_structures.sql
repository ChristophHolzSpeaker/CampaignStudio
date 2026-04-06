create table "campaign_ad_packages" (
	"id" serial primary key not null,
	"campaign_id" integer not null references "public"."campaigns"("id") on delete cascade,
	"version_number" integer not null default 1,
	"channel" text not null default 'google_ads_search',
	"status" text not null default 'draft',
	"strategy_json" jsonb not null default '{}',
	"created_at" timestamp default now() not null,
	"updated_at" timestamp default now() not null
);

create table "campaign_ad_groups" (
	"id" serial primary key not null,
	"ad_package_id" integer not null references "public"."campaign_ad_packages"("id") on delete cascade,
	"campaign_page_id" integer references "public"."campaign_pages"("id") on delete set null,
	"name" text not null,
	"intent_summary" text,
	"position" integer not null default 0,
	"created_at" timestamp default now() not null,
	"updated_at" timestamp default now() not null
);

create table "campaign_keywords" (
	"id" serial primary key not null,
	"ad_group_id" integer not null references "public"."campaign_ad_groups"("id") on delete cascade,
	"keyword_text" text not null,
	"match_type" text not null,
	"is_negative" boolean not null default false,
	"rationale" text,
	"position" integer not null default 0,
	"created_at" timestamp default now() not null,
	"updated_at" timestamp default now() not null
);

create table "campaign_ads" (
	"id" serial primary key not null,
	"ad_group_id" integer not null references "public"."campaign_ad_groups"("id") on delete cascade,
	"ad_type" text not null default 'responsive_search_ad',
	"headlines_json" jsonb not null default '[]',
	"descriptions_json" jsonb not null default '[]',
	"path_1" text,
	"path_2" text,
	"created_at" timestamp default now() not null,
	"updated_at" timestamp default now() not null
);
