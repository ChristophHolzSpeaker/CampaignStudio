alter table ab_experiments
add column started_at timestamp with time zone,
add column ended_at timestamp with time zone;

create or replace function set_ab_experiment_lifecycle_timestamps()
returns trigger
language plpgsql
as $$
begin
	if new.status = 'running' and old.status is distinct from 'running' and new.started_at is null then
		new.started_at = now();
	end if;

	if new.status = 'completed' and old.status is distinct from 'completed' and new.ended_at is null then
		new.ended_at = now();
	end if;

	return new;
end;
$$;

create trigger ab_experiments_lifecycle_timestamps
before update of status on ab_experiments
for each row
execute function set_ab_experiment_lifecycle_timestamps();

alter table lead_events
add column experiment_id uuid references ab_experiments(id) on delete set null,
add column variant_id uuid references ab_variants(id) on delete set null,
add constraint lead_events_experiment_variant_pair_check check (
	(experiment_id is null and variant_id is null)
	or (experiment_id is not null and variant_id is not null)
);

create index lead_events_experiment_variant_event_idx on lead_events (
	experiment_id,
	variant_id,
	event_type,
	occurred_at
);

alter table ab_events
add column campaign_page_id integer references campaign_pages(id) on delete set null;

update ab_events
set campaign_page_id = (
	select campaign_pages.id
	from campaign_pages
	where campaign_pages.slug = ab_events.slug
	order by campaign_pages.is_published desc, campaign_pages.created_at desc
	limit 1
)
where campaign_page_id is null and slug is not null;

create index ab_events_campaign_page_created_idx on ab_events (campaign_page_id, created_at);

update ab_experiments
set
	status = 'completed',
	started_at = coalesce(started_at, created_at),
	ended_at = coalesce(ended_at, now()),
	updated_at = now()
where key = 'speaker_primary_cta_v1';

with inserted_experiment as (
	insert into ab_experiments (
		key,
		name,
		route_pattern,
		status,
		goal_event,
		traffic_allocation
	)
	values (
		'speaker_hero_autoplay_video_v1',
		'Speaker Hero Autoplay Video v1',
		'/speaker/[slug]',
		'draft',
		'lead_created',
		100
	)
	on conflict (key) do update
	set
		name = excluded.name,
		route_pattern = excluded.route_pattern,
		goal_event = excluded.goal_event,
		traffic_allocation = excluded.traffic_allocation,
		updated_at = now()
	returning id
)
insert into ab_variants (experiment_id, key, name, weight, config, is_control)
select
	id,
	'A',
	'Static hero image',
	50,
	'{"hero_media_mode":"static_image"}'::jsonb,
	true
from inserted_experiment
union all
select
	id,
	'B',
	'Autoplay YouTube hero video',
	50,
	'{"hero_media_mode":"autoplay_video"}'::jsonb,
	false
from inserted_experiment
on conflict (experiment_id, key) do update
set
	name = excluded.name,
	weight = excluded.weight,
	config = excluded.config,
	is_control = excluded.is_control;
