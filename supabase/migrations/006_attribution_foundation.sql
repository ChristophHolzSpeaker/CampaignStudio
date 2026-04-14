-- Attribution foundation: lead journeys, events, and booking links

create table lead_journeys (
	id uuid primary key default gen_random_uuid(),
	campaign_id integer references campaigns(id) on delete set null,
	campaign_page_id integer references campaign_pages(id) on delete set null,
	first_touch_type text not null,
	first_touch_at timestamp with time zone default now() not null,
	contact_email text,
	contact_name text,
	current_stage text not null default 'new',
	hubspot_contact_id text,
	hubspot_deal_id text,
	outcome text,
	created_at timestamp with time zone default now() not null,
	updated_at timestamp with time zone default now() not null
);

create index lead_journeys_contact_campaign_updated_idx on lead_journeys(contact_email, campaign_id, updated_at);
create index lead_journeys_stage_idx on lead_journeys(current_stage);

create table lead_events (
	id uuid primary key default gen_random_uuid(),
	lead_journey_id uuid references lead_journeys(id) on delete set null,
	campaign_id integer references campaigns(id) on delete set null,
	campaign_page_id integer references campaign_pages(id) on delete set null,
	event_type text not null,
	event_source text not null,
	event_payload jsonb not null default '{}'::jsonb,
	session_id text,
	anonymous_id text,
	occurred_at timestamp with time zone default now() not null
);

create index lead_events_journey_occurred_idx on lead_events(lead_journey_id, occurred_at);
create index lead_events_campaign_page_occurred_idx on lead_events(campaign_id, campaign_page_id, occurred_at);
create index lead_events_session_idx on lead_events(session_id);
create index lead_events_anonymous_idx on lead_events(anonymous_id);

create table booking_links (
	id uuid primary key default gen_random_uuid(),
	lead_journey_id uuid not null references lead_journeys(id) on delete cascade,
	campaign_id integer not null references campaigns(id) on delete cascade,
	token text not null,
	expires_at timestamp with time zone not null,
	clicked_at timestamp with time zone,
	booked_at timestamp with time zone,
	created_at timestamp with time zone default now() not null,
	updated_at timestamp with time zone default now() not null
);

create unique index booking_links_token_key on booking_links(token);
create index booking_links_expires_at_idx on booking_links(expires_at);
