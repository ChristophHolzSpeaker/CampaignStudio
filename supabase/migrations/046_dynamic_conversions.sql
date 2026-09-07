create table campaign_tracking (
 campaign_id integer primary key references campaigns(id) on delete cascade,
 config jsonb not null, updated_at timestamptz not null default now()
);
create table ad_clicks (
 id uuid primary key default gen_random_uuid(), visitor_id text not null,
 campaign_id integer not null references campaigns(id), campaign_page_id integer not null references campaign_pages(id),
 kind text not null, click_id text not null, captured_at timestamptz not null default now()
);
create unique index ad_clicks_visitor_click_idx on ad_clicks(visitor_id,kind,click_id);
create index ad_clicks_visitor_time_idx on ad_clicks(visitor_id,captured_at);
create table tracking_events (
 id uuid primary key, campaign_id integer not null references campaigns(id),
 campaign_page_id integer references campaign_pages(id), campaign_visit_id integer references campaign_visits(id),
 lead_journey_id uuid references lead_journeys(id), event_name text not null, source text not null,
 action text, section text, payload jsonb not null, occurred_at timestamptz not null default now()
);
create index tracking_events_visit_time_idx on tracking_events(campaign_visit_id,occurred_at);
create index tracking_events_journey_time_idx on tracking_events(lead_journey_id,occurred_at);
create table conversion_deliveries (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references tracking_events(id),
 click_captured_at timestamptz, request_key text not null unique, payload_hash text not null, request_payload jsonb not null,
 status text not null default 'pending', attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(), google_request_id text, last_error text,
 updated_at timestamptz not null default now()
);
create index conversion_deliveries_pending_idx on conversion_deliveries(status,next_attempt_at);
alter table campaign_tracking enable row level security;
alter table ad_clicks enable row level security;
alter table tracking_events enable row level security;
alter table conversion_deliveries enable row level security;
revoke all on campaign_tracking, ad_clicks, tracking_events, conversion_deliveries from anon, authenticated;
-- Server access uses the existing privileged Drizzle connection; no browser policies.
