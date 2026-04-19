drop view if exists campaign_visit_metrics;

create view campaign_visit_metrics as
select
	c.id as campaign_id,
	count(cv.id)::integer as visit_count,
	count(distinct cv.ip_hash_or_session_identifier)::integer as unique_visitor_count,
	max(cv.visited_at) as last_visited_at
from campaigns c
left join campaign_visits cv on cv.campaign_id = c.id
group by c.id;
