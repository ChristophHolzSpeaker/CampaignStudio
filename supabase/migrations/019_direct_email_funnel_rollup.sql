create or replace view vw_booking_enriched as
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
	lj.attribution_model_version,
	lj.first_touch_type
from bookings b
left join lead_journeys lj on lj.id = b.lead_journey_id
left join campaigns jc on jc.id = lj.campaign_id
left join campaign_pages jp on jp.id = lj.campaign_page_id
left join campaigns fc on fc.id = lj.first_campaign_id
left join campaign_pages fp on fp.id = lj.first_page_id
left join campaigns lc on lc.id = lj.last_campaign_id
left join campaign_pages lp on lp.id = lj.last_page_id;

drop view if exists vw_direct_email_funnel_daily;

create view vw_direct_email_funnel_daily as
with
	visit_daily as (
		select
			date(visited_at) as report_date,
			count(*)::integer as visits
		from vw_visit_enriched
		group by date(visited_at)
	),
	direct_email_cta_daily as (
		select
			date(occurred_at) as report_date,
			count(*)::integer as direct_email_cta_clicks
		from vw_lead_event_enriched
		where event_type = 'cta_click' and coalesce(event_payload ->> 'cta_type', '') = 'email'
		group by date(occurred_at)
	),
	alias_inbound_daily as (
		select
			date(occurred_at) as report_date,
			count(*)::integer as alias_inbound_messages
		from vw_lead_event_enriched
		where event_type = 'message_received' and coalesce(event_payload ->> 'attribution_status', '') = 'parsed'
		group by date(occurred_at)
	),
	email_first_touch_booking_daily as (
		select
			date(booking_updated_at) as report_date,
			count(*)::integer as email_first_touch_bookings
		from vw_booking_enriched
		where booking_status = 'confirmed' and first_touch_type = 'email'
		group by date(booking_updated_at)
	),
	all_dates as (
		select report_date from visit_daily
		union
		select report_date from direct_email_cta_daily
		union
		select report_date from alias_inbound_daily
		union
		select report_date from email_first_touch_booking_daily
	)
select
	d.report_date,
	coalesce(v.visits, 0) as visits,
	coalesce(c.direct_email_cta_clicks, 0) as direct_email_cta_clicks,
	coalesce(a.alias_inbound_messages, 0) as alias_inbound_messages,
	(coalesce(c.direct_email_cta_clicks, 0) + coalesce(a.alias_inbound_messages, 0))::integer as direct_email_entries,
	coalesce(b.email_first_touch_bookings, 0) as email_first_touch_bookings,
	round(
		(
			(coalesce(c.direct_email_cta_clicks, 0) + coalesce(a.alias_inbound_messages, 0))::numeric
			/ nullif(coalesce(v.visits, 0), 0)
		),
		4
	) as visit_to_direct_email_rate,
	round(
		(coalesce(b.email_first_touch_bookings, 0)::numeric / nullif((coalesce(c.direct_email_cta_clicks, 0) + coalesce(a.alias_inbound_messages, 0)), 0)),
		4
	) as email_to_booking_rate
from all_dates d
left join visit_daily v on v.report_date = d.report_date
left join direct_email_cta_daily c on c.report_date = d.report_date
left join alias_inbound_daily a on a.report_date = d.report_date
left join email_first_touch_booking_daily b on b.report_date = d.report_date;
