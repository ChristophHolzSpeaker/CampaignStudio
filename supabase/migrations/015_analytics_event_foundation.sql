-- Phase 1 analytics event foundation (additive schema extension)
-- Stable CTA dimensions are nullable to preserve compatibility with historical events.

alter table lead_events
add column cta_key text,
add column cta_label text,
add column cta_section text,
add column cta_variant text;
