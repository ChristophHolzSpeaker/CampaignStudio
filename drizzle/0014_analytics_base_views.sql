drop view if exists "vw_booking_enriched";
drop view if exists "vw_lead_event_enriched";
drop view if exists "vw_lead_journey_enriched";
drop view if exists "vw_visit_enriched";

create view "vw_visit_enriched" as
select
	cv.id as visit_id,
	cv.visited_at,
	cv.campaign_id,
	c.name as campaign_name,
	cv.campaign_page_id as page_id,
	cp.slug as page_slug,
	cv.slug as visit_slug,
	cv.ip_hash_or_session_identifier as visitor_identifier,
	cv.utm_source,
	cv.utm_medium,
	cv.utm_campaign,
	cv.utm_term,
	cv.utm_content,
	cv.referrer,
	cv.user_agent
from "campaign_visits" cv
left join "campaigns" c on c.id = cv.campaign_id
left join "campaign_pages" cp on cp.id = cv.campaign_page_id;

create view "vw_lead_journey_enriched" as
select
	lj.id as journey_id,
	lj.created_at as journey_created_at,
	lj.updated_at as journey_updated_at,
	lj.current_stage,
	lj.outcome,
	lj.contact_email,
	lj.contact_name,
	lj.first_touch_type,
	lj.first_touch_at,
	lj.campaign_id as journey_campaign_id,
	jc.name as journey_campaign_name,
	lj.campaign_page_id as journey_page_id,
	jp.slug as journey_page_slug,
	lj.first_visit_id,
	lj.first_campaign_id,
	fc.name as first_campaign_name,
	lj.first_page_id,
	fp.slug as first_page_slug,
	lj.first_utm_source,
	lj.first_utm_medium,
	lj.first_utm_campaign,
	lj.first_referrer,
	lj.first_cta_key,
	lj.first_seen_at,
	lj.last_visit_id,
	lj.last_campaign_id,
	lc.name as last_campaign_name,
	lj.last_page_id,
	lp.slug as last_page_slug,
	lj.last_utm_source,
	lj.last_utm_medium,
	lj.last_utm_campaign,
	lj.last_referrer,
	lj.last_cta_key,
	lj.last_seen_at,
	lj.attribution_model_version
from "lead_journeys" lj
left join "campaigns" jc on jc.id = lj.campaign_id
left join "campaign_pages" jp on jp.id = lj.campaign_page_id
left join "campaigns" fc on fc.id = lj.first_campaign_id
left join "campaign_pages" fp on fp.id = lj.first_page_id
left join "campaigns" lc on lc.id = lj.last_campaign_id
left join "campaign_pages" lp on lp.id = lj.last_page_id;

create view "vw_lead_event_enriched" as
select
	le.id as lead_event_id,
	le.occurred_at,
	le.event_type,
	le.event_source,
	le.event_payload,
	le.session_id,
	le.anonymous_id,
	le.cta_key,
	le.cta_label,
	le.cta_section,
	le.cta_variant,
	le.lead_journey_id as journey_id,
	le.campaign_id as event_campaign_id,
	ec.name as event_campaign_name,
	le.campaign_page_id as event_page_id,
	ep.slug as event_page_slug,
	lj.campaign_id as journey_campaign_id,
	jc.name as journey_campaign_name,
	lj.campaign_page_id as journey_page_id,
	jp.slug as journey_page_slug,
	coalesce(le.campaign_id, lj.campaign_id, lj.last_campaign_id, lj.first_campaign_id) as resolved_campaign_id,
	rc.name as resolved_campaign_name,
	coalesce(le.campaign_page_id, lj.campaign_page_id, lj.last_page_id, lj.first_page_id) as resolved_page_id,
	rp.slug as resolved_page_slug,
	lj.first_utm_source as journey_first_utm_source,
	lj.first_utm_medium as journey_first_utm_medium,
	lj.first_utm_campaign as journey_first_utm_campaign,
	lj.last_utm_source as journey_last_utm_source,
	lj.last_utm_medium as journey_last_utm_medium,
	lj.last_utm_campaign as journey_last_utm_campaign,
	lj.first_seen_at as journey_first_seen_at,
	lj.last_seen_at as journey_last_seen_at,
	lj.attribution_model_version as journey_attribution_model_version
from "lead_events" le
left join "lead_journeys" lj on lj.id = le.lead_journey_id
left join "campaigns" ec on ec.id = le.campaign_id
left join "campaign_pages" ep on ep.id = le.campaign_page_id
left join "campaigns" jc on jc.id = lj.campaign_id
left join "campaign_pages" jp on jp.id = lj.campaign_page_id
left join "campaigns" rc on rc.id = coalesce(le.campaign_id, lj.campaign_id, lj.last_campaign_id, lj.first_campaign_id)
left join "campaign_pages" rp on rp.id = coalesce(le.campaign_page_id, lj.campaign_page_id, lj.last_page_id, lj.first_page_id);

create view "vw_booking_enriched" as
select
	b.id as booking_id,
	b.booking_type,
	b.status as booking_status,
	b.created_at as booking_created_at,
	b.updated_at as booking_updated_at,
	b.starts_at,
	b.ends_at,
	b.is_repeat_interaction,
	b.email,
	b.name,
	b.company,
	b.scope,
	b.lead_journey_id as journey_id,
	lj.current_stage as journey_current_stage,
	lj.outcome as journey_outcome,
	lj.campaign_id as journey_campaign_id,
	jc.name as journey_campaign_name,
	lj.campaign_page_id as journey_page_id,
	jp.slug as journey_page_slug,
	lj.first_visit_id,
	lj.first_campaign_id,
	fc.name as first_campaign_name,
	lj.first_page_id,
	fp.slug as first_page_slug,
	lj.first_utm_source,
	lj.first_utm_medium,
	lj.first_utm_campaign,
	lj.first_referrer,
	lj.first_cta_key,
	lj.first_seen_at,
	lj.last_visit_id,
	lj.last_campaign_id,
	lc.name as last_campaign_name,
	lj.last_page_id,
	lp.slug as last_page_slug,
	lj.last_utm_source,
	lj.last_utm_medium,
	lj.last_utm_campaign,
	lj.last_referrer,
	lj.last_cta_key,
	lj.last_seen_at,
	lj.attribution_model_version
from "bookings" b
left join "lead_journeys" lj on lj.id = b.lead_journey_id
left join "campaigns" jc on jc.id = lj.campaign_id
left join "campaign_pages" jp on jp.id = lj.campaign_page_id
left join "campaigns" fc on fc.id = lj.first_campaign_id
left join "campaign_pages" fp on fp.id = lj.first_page_id
left join "campaigns" lc on lc.id = lj.last_campaign_id
left join "campaign_pages" lp on lp.id = lj.last_page_id;
