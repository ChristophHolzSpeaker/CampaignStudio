-- Campaign Studio MVP Schema
-- This migration sets up the core tables for the Campaign Studio MVP

-- Campaigns table
create table campaigns (
	id serial primary key,
	name text not null,
	audience text not null,
	format text not null,
	topic text not null,
	notes text,
	status text not null default 'draft',
	created_at timestamp with time zone default now() not null,
	updated_at timestamp with time zone default now() not null,
	created_by text
);

-- Campaign pages table
create table campaign_pages (
	id serial primary key,
	campaign_id integer not null references campaigns(id) on delete cascade,
	version_number integer not null default 1,
	structured_content_json jsonb not null,
	slug text not null,
	is_published boolean not null default false,
	published_at timestamp with time zone,
	created_at timestamp with time zone default now() not null,
	updated_at timestamp with time zone default now() not null
);

-- Campaign visits table
create table campaign_visits (
	id serial primary key,
	campaign_id integer not null references campaigns(id) on delete cascade,
	campaign_page_id integer references campaign_pages(id) on delete set null,
	slug text not null,
	visited_at timestamp with time zone default now() not null,
	referrer text,
	utm_source text,
	utm_medium text,
	utm_campaign text,
	utm_term text,
	utm_content text,
	user_agent text,
	ip_hash_or_session_identifier text
);

-- Generation jobs table
create table generation_jobs (
	id serial primary key,
	campaign_id integer not null references campaigns(id) on delete cascade,
	status text not null default 'pending', -- pending, processing, completed, failed
	input_payload jsonb,
	output_payload jsonb,
	error_message text,
	created_at timestamp with time zone default now() not null,
	completed_at timestamp with time zone
);

-- Indexes for better query performance
create index idx_campaigns_status on campaigns(status);
create index idx_campaign_pages_campaign_id on campaign_pages(campaign_id);
create index idx_campaign_pages_slug on campaign_pages(slug) where is_published = true;
create index idx_campaign_visits_campaign_id on campaign_visits(campaign_id);
create index idx_campaign_visits_visited_at on campaign_visits(visited_at);
create index idx_generation_jobs_campaign_id on generation_jobs(campaign_id);
create index idx_generation_jobs_status on generation_jobs(status);
