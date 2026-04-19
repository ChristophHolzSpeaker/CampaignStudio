drop view if exists vw_cta_performance;
drop view if exists vw_source_medium_performance;
drop view if exists vw_campaign_conversion_summary;
drop view if exists vw_funnel_daily;

create view vw_funnel_daily as
with
	visit_daily as (
		select
			date(visited_at) as report_date,
			count(*)::integer as visits,
			count(distinct visitor_identifier) filter (where visitor_identifier is not null)::integer as unique_visitors
		from vw_visit_enriched
		group by date(visited_at)
	),
	journey_daily as (
		select
			date(journey_created_at) as report_date,
			count(*)::integer as journeys_created
		from vw_lead_journey_enriched
		group by date(journey_created_at)
	),
	identified_daily as (
		select
			date(occurred_at) as report_date,
			count(distinct journey_id)::integer as identified_leads
		from vw_lead_event_enriched
		where event_type = 'lead_identified'
		group by date(occurred_at)
	),
	inbound_message_daily as (
		select
			date(occurred_at) as report_date,
			count(*)::integer as inbound_messages
		from vw_lead_event_enriched
		where event_type = 'message_received'
		group by date(occurred_at)
	),
	booking_link_clicked_daily as (
		select
			date(occurred_at) as report_date,
			count(*)::integer as booking_link_clicked
		from vw_lead_event_enriched
		where event_type = 'booking_link_clicked'
		group by date(occurred_at)
	),
	booking_completed_daily as (
		select
			date(booking_updated_at) as report_date,
			count(*)::integer as bookings_completed
		from vw_booking_enriched
		where booking_status = 'confirmed'
		group by date(booking_updated_at)
	),
	all_dates as (
		select report_date from visit_daily
		union
		select report_date from journey_daily
		union
		select report_date from identified_daily
		union
		select report_date from inbound_message_daily
		union
		select report_date from booking_link_clicked_daily
		union
		select report_date from booking_completed_daily
	)
select
	d.report_date,
	coalesce(v.visits, 0) as visits,
	coalesce(v.unique_visitors, 0) as unique_visitors,
	coalesce(j.journeys_created, 0) as journeys_created,
	coalesce(i.identified_leads, 0) as identified_leads,
	coalesce(m.inbound_messages, 0) as inbound_messages,
	coalesce(bl.booking_link_clicked, 0) as booking_link_clicked,
	coalesce(bc.bookings_completed, 0) as bookings_completed,
	round((coalesce(i.identified_leads, 0)::numeric / nullif(coalesce(v.visits, 0), 0)), 4) as visit_to_lead_rate,
	round((coalesce(bc.bookings_completed, 0)::numeric / nullif(coalesce(i.identified_leads, 0), 0)), 4) as lead_to_booking_rate,
	round((coalesce(bc.bookings_completed, 0)::numeric / nullif(coalesce(v.visits, 0), 0)), 4) as visit_to_booking_rate
from all_dates d
left join visit_daily v on v.report_date = d.report_date
left join journey_daily j on j.report_date = d.report_date
left join identified_daily i on i.report_date = d.report_date
left join inbound_message_daily m on m.report_date = d.report_date
left join booking_link_clicked_daily bl on bl.report_date = d.report_date
left join booking_completed_daily bc on bc.report_date = d.report_date;

create view vw_campaign_conversion_summary as
with
	visit_by_campaign as (
		select
			campaign_id,
			max(campaign_name) as campaign_name,
			count(*)::integer as visit_campaign_visits
		from vw_visit_enriched
		group by campaign_id
	),
	journey_by_campaign as (
		select
			journey_campaign_id as campaign_id,
			max(journey_campaign_name) as campaign_name,
			count(distinct journey_id)::integer as journey_campaign_leads
		from vw_lead_journey_enriched
		where journey_campaign_id is not null
		group by journey_campaign_id
	),
	first_touch_leads_by_campaign as (
		select
			first_campaign_id as campaign_id,
			max(first_campaign_name) as campaign_name,
			count(distinct journey_id)::integer as first_touch_leads
		from vw_lead_journey_enriched
		where first_campaign_id is not null
		group by first_campaign_id
	),
	first_touch_bookings_by_campaign as (
		select
			first_campaign_id as campaign_id,
			max(first_campaign_name) as campaign_name,
			count(distinct booking_id)::integer as first_touch_bookings
		from vw_booking_enriched
		where first_campaign_id is not null and booking_status = 'confirmed'
		group by first_campaign_id
	),
	campaign_keys as (
		select campaign_id from visit_by_campaign
		union
		select campaign_id from journey_by_campaign
		union
		select campaign_id from first_touch_leads_by_campaign
		union
		select campaign_id from first_touch_bookings_by_campaign
	)
select
	ck.campaign_id,
	coalesce(v.campaign_name, j.campaign_name, ft.campaign_name, fb.campaign_name) as campaign_name,
	coalesce(v.visit_campaign_visits, 0) as visit_campaign_visits,
	coalesce(j.journey_campaign_leads, 0) as journey_campaign_leads,
	coalesce(ft.first_touch_leads, 0) as first_touch_leads,
	coalesce(fb.first_touch_bookings, 0) as first_touch_bookings,
	round((coalesce(j.journey_campaign_leads, 0)::numeric / nullif(coalesce(v.visit_campaign_visits, 0), 0)), 4) as visit_to_journey_lead_rate,
	round((coalesce(ft.first_touch_leads, 0)::numeric / nullif(coalesce(v.visit_campaign_visits, 0), 0)), 4) as visit_to_first_touch_lead_rate,
	round((coalesce(fb.first_touch_bookings, 0)::numeric / nullif(coalesce(ft.first_touch_leads, 0), 0)), 4) as first_touch_lead_to_booking_rate,
	round((coalesce(fb.first_touch_bookings, 0)::numeric / nullif(coalesce(v.visit_campaign_visits, 0), 0)), 4) as visit_to_first_touch_booking_rate
from campaign_keys ck
left join visit_by_campaign v on v.campaign_id = ck.campaign_id
left join journey_by_campaign j on j.campaign_id = ck.campaign_id
left join first_touch_leads_by_campaign ft on ft.campaign_id = ck.campaign_id
left join first_touch_bookings_by_campaign fb on fb.campaign_id = ck.campaign_id;

create view vw_source_medium_performance as
with
	visit_touch as (
		select
			utm_source,
			utm_medium,
			count(*)::integer as visit_touch_visits
		from vw_visit_enriched
		group by utm_source, utm_medium
	),
	first_touch_leads as (
		select
			first_utm_source as utm_source,
			first_utm_medium as utm_medium,
			count(distinct journey_id)::integer as first_touch_leads
		from vw_lead_journey_enriched
		group by first_utm_source, first_utm_medium
	),
	first_touch_bookings as (
		select
			first_utm_source as utm_source,
			first_utm_medium as utm_medium,
			count(distinct booking_id)::integer as first_touch_bookings
		from vw_booking_enriched
		where booking_status = 'confirmed'
		group by first_utm_source, first_utm_medium
	),
	keys as (
		select utm_source, utm_medium from visit_touch
		union
		select utm_source, utm_medium from first_touch_leads
		union
		select utm_source, utm_medium from first_touch_bookings
	)
select
	k.utm_source,
	k.utm_medium,
	coalesce(v.visit_touch_visits, 0) as visit_touch_visits,
	coalesce(l.first_touch_leads, 0) as first_touch_leads,
	coalesce(b.first_touch_bookings, 0) as first_touch_bookings,
	round((coalesce(l.first_touch_leads, 0)::numeric / nullif(coalesce(v.visit_touch_visits, 0), 0)), 4) as visit_to_first_touch_lead_rate,
	round((coalesce(b.first_touch_bookings, 0)::numeric / nullif(coalesce(l.first_touch_leads, 0), 0)), 4) as first_touch_lead_to_booking_rate,
	round((coalesce(b.first_touch_bookings, 0)::numeric / nullif(coalesce(v.visit_touch_visits, 0), 0)), 4) as visit_to_first_touch_booking_rate
from keys k
left join visit_touch v on v.utm_source is not distinct from k.utm_source and v.utm_medium is not distinct from k.utm_medium
left join first_touch_leads l on l.utm_source is not distinct from k.utm_source and l.utm_medium is not distinct from k.utm_medium
left join first_touch_bookings b on b.utm_source is not distinct from k.utm_source and b.utm_medium is not distinct from k.utm_medium;

create view vw_cta_performance as
with
	cta_clicks as (
		select
			cta_key,
			max(cta_label) filter (where cta_label is not null) as cta_label,
			max(cta_section) filter (where cta_section is not null) as cta_section,
			max(cta_variant) filter (where cta_variant is not null) as cta_variant,
			count(*)::integer as clicks
		from vw_lead_event_enriched
		where event_type = 'cta_click' and cta_key is not null
		group by cta_key
	),
	first_touch_leads as (
		select
			first_cta_key as cta_key,
			count(distinct journey_id)::integer as first_touch_leads
		from vw_lead_journey_enriched
		where first_cta_key is not null
		group by first_cta_key
	),
	first_touch_bookings as (
		select
			first_cta_key as cta_key,
			count(distinct booking_id)::integer as first_touch_bookings
		from vw_booking_enriched
		where first_cta_key is not null and booking_status = 'confirmed'
		group by first_cta_key
	),
	keys as (
		select cta_key from cta_clicks
		union
		select cta_key from first_touch_leads
		union
		select cta_key from first_touch_bookings
	)
select
	k.cta_key,
	c.cta_label,
	c.cta_section,
	c.cta_variant,
	coalesce(c.clicks, 0) as clicks,
	coalesce(l.first_touch_leads, 0) as first_touch_leads,
	coalesce(b.first_touch_bookings, 0) as first_touch_bookings,
	round((coalesce(l.first_touch_leads, 0)::numeric / nullif(coalesce(c.clicks, 0), 0)), 4) as click_to_first_touch_lead_rate,
	round((coalesce(b.first_touch_bookings, 0)::numeric / nullif(coalesce(c.clicks, 0), 0)), 4) as click_to_first_touch_booking_rate
from keys k
left join cta_clicks c on c.cta_key = k.cta_key
left join first_touch_leads l on l.cta_key = k.cta_key
left join first_touch_bookings b on b.cta_key = k.cta_key;
