-- Consent ownership records are operational, not page-view measurements.
ALTER TABLE campaign_visits ADD COLUMN is_consent_only boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW campaign_visit_metrics AS
SELECT c.id AS campaign_id,
 count(cv.id)::integer AS visit_count,
 count(DISTINCT cv.ip_hash_or_session_identifier)::integer AS unique_visitor_count,
 max(cv.visited_at) AS last_visited_at
FROM campaigns c
LEFT JOIN campaign_visits cv ON cv.campaign_id=c.id AND NOT cv.is_consent_only
GROUP BY c.id;

CREATE OR REPLACE VIEW vw_visit_enriched AS
SELECT cv.id AS visit_id,cv.visited_at,cv.campaign_id,c.name AS campaign_name,
 cv.campaign_page_id AS page_id,cp.slug AS page_slug,cv.slug AS visit_slug,
 cv.ip_hash_or_session_identifier AS visitor_identifier,
 cv.utm_source,cv.utm_medium,cv.utm_campaign,cv.utm_term,cv.utm_content,
 cv.referrer,cv.user_agent,cv.ip_address,cv.country,cv.city,
 cv.bounced,cv.engaged_at,cv.engagement_duration_ms
FROM campaign_visits cv
LEFT JOIN campaigns c ON c.id=cv.campaign_id
LEFT JOIN campaign_pages cp ON cp.id=cv.campaign_page_id
WHERE NOT cv.is_consent_only;
