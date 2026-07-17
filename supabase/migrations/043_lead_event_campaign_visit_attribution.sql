alter table lead_events
	add column campaign_visit_id integer references campaign_visits(id) on delete set null;

create index lead_events_campaign_visit_id_idx on lead_events(campaign_visit_id);

create or replace view vw_lead_event_enriched as
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
	lj.attribution_model_version as journey_attribution_model_version,
	le.campaign_visit_id,
	av.visited_at as action_visit_at,
	av.ip_hash_or_session_identifier as action_visitor_identifier,
	av.utm_source as action_utm_source,
	av.utm_medium as action_utm_medium,
	av.utm_campaign as action_utm_campaign,
	av.utm_term as action_utm_term,
	av.utm_content as action_utm_content,
	av.referrer as action_referrer
from lead_events le
left join lead_journeys lj on lj.id = le.lead_journey_id
left join campaigns ec on ec.id = le.campaign_id
left join campaign_pages ep on ep.id = le.campaign_page_id
left join campaigns jc on jc.id = lj.campaign_id
left join campaign_pages jp on jp.id = lj.campaign_page_id
left join campaigns rc on rc.id = coalesce(le.campaign_id, lj.campaign_id, lj.last_campaign_id, lj.first_campaign_id)
left join campaign_pages rp on rp.id = coalesce(le.campaign_page_id, lj.campaign_page_id, lj.last_page_id, lj.first_page_id)
left join campaign_visits av on av.id = le.campaign_visit_id;
