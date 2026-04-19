-- Phase 2 attribution persistence on lead_journeys
-- Stores durable first-touch and last-touch snapshots for reporting.

alter table lead_journeys
add column first_visit_id integer references campaign_visits(id) on delete set null,
add column first_campaign_id integer references campaigns(id) on delete set null,
add column first_page_id integer references campaign_pages(id) on delete set null,
add column first_utm_source text,
add column first_utm_medium text,
add column first_utm_campaign text,
add column first_referrer text,
add column first_cta_key text,
add column first_seen_at timestamp,
add column last_visit_id integer references campaign_visits(id) on delete set null,
add column last_campaign_id integer references campaigns(id) on delete set null,
add column last_page_id integer references campaign_pages(id) on delete set null,
add column last_utm_source text,
add column last_utm_medium text,
add column last_utm_campaign text,
add column last_referrer text,
add column last_cta_key text,
add column last_seen_at timestamp,
add column attribution_model_version text not null default 'journey_attribution_v1';
