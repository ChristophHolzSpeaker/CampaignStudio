-- No historical backfill: a visitor cookie alone cannot establish an exact visit.
create table visit_ad_clicks (
 campaign_visit_id integer not null references campaign_visits(id) on delete cascade,
 ad_click_id uuid not null references ad_clicks(id) on delete cascade,
 observed_at timestamptz not null default now(),
 primary key (campaign_visit_id, ad_click_id)
);
create index visit_ad_clicks_click_idx on visit_ad_clicks(ad_click_id);
create table visit_ad_consent (
 campaign_visit_id integer primary key references campaign_visits(id) on delete cascade,
 ad_user_data text not null,
 evidence_ref text not null,
 policy_version text not null,
 recorded_at timestamptz not null default now()
);
alter table visit_ad_clicks enable row level security;
alter table visit_ad_consent enable row level security;
