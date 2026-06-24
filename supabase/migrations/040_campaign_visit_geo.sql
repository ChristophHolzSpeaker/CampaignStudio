alter table campaign_visits
	add column ip_address text,
	add column country text,
	add column city text;

create or replace view vw_visit_enriched as
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
	cv.user_agent,
	cv.ip_address,
	cv.country,
	cv.city
from campaign_visits cv
left join campaigns c on c.id = cv.campaign_id
left join campaign_pages cp on cp.id = cv.campaign_page_id;
