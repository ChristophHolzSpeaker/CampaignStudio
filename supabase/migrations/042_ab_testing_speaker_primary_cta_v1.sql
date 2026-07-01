create table ab_experiments (
	id uuid primary key default gen_random_uuid(),
	key text not null,
	name text not null,
	route_pattern text not null,
	status text not null default 'draft',
	goal_event text,
	traffic_allocation integer not null default 100,
	created_at timestamp with time zone not null default now(),
	updated_at timestamp with time zone not null default now(),
	constraint ab_experiments_key_not_blank check (length(trim(key)) > 0),
	constraint ab_experiments_name_not_blank check (length(trim(name)) > 0),
	constraint ab_experiments_route_pattern_not_blank check (length(trim(route_pattern)) > 0),
	constraint ab_experiments_status_check check (status in ('draft', 'running', 'paused', 'completed')),
	constraint ab_experiments_traffic_allocation_check check (traffic_allocation between 0 and 100)
);

create unique index ab_experiments_key_key on ab_experiments (key);
create index ab_experiments_status_idx on ab_experiments (status);

create table ab_variants (
	id uuid primary key default gen_random_uuid(),
	experiment_id uuid not null references ab_experiments(id) on delete cascade,
	key text not null,
	name text not null,
	weight integer not null default 50,
	config jsonb not null default '{}'::jsonb,
	is_control boolean not null default false,
	created_at timestamp with time zone not null default now(),
	constraint ab_variants_key_not_blank check (length(trim(key)) > 0),
	constraint ab_variants_name_not_blank check (length(trim(name)) > 0),
	constraint ab_variants_weight_check check (weight > 0)
);

create unique index ab_variants_experiment_id_key_key on ab_variants (experiment_id, key);
create index ab_variants_experiment_id_idx on ab_variants (experiment_id);

create table ab_visitor_assignments (
	id uuid primary key default gen_random_uuid(),
	experiment_id uuid not null references ab_experiments(id) on delete cascade,
	variant_id uuid not null references ab_variants(id) on delete cascade,
	visitor_id text not null,
	assigned_at timestamp with time zone not null default now(),
	constraint ab_visitor_assignments_visitor_id_not_blank check (length(trim(visitor_id)) > 0)
);

create unique index ab_visitor_assignments_experiment_visitor_key on ab_visitor_assignments (experiment_id, visitor_id);
create index ab_visitor_assignments_experiment_idx on ab_visitor_assignments (experiment_id);
create index ab_visitor_assignments_variant_idx on ab_visitor_assignments (variant_id);

create table ab_events (
	id uuid primary key default gen_random_uuid(),
	experiment_id uuid references ab_experiments(id) on delete set null,
	variant_id uuid references ab_variants(id) on delete set null,
	visitor_id text,
	session_id text,
	event_type text not null,
	route text,
	slug text,
	metadata jsonb not null default '{}'::jsonb,
	created_at timestamp with time zone not null default now(),
	constraint ab_events_event_type_not_blank check (length(trim(event_type)) > 0)
);

create index ab_events_experiment_variant_event_created_idx on ab_events (
	experiment_id,
	variant_id,
	event_type,
	created_at
);
create index ab_events_slug_created_idx on ab_events (slug, created_at);
create index ab_events_visitor_idx on ab_events (visitor_id);

with inserted_experiment as (
	insert into ab_experiments (key, name, route_pattern, status, goal_event, traffic_allocation)
	values (
		'speaker_primary_cta_v1',
		'Speaker Primary CTA Test v1',
		'/speaker/[slug]',
		'running',
		'lead_created',
		100
	)
	on conflict (key) do update
	set
		name = excluded.name,
		route_pattern = excluded.route_pattern,
		status = excluded.status,
		goal_event = excluded.goal_event,
		traffic_allocation = excluded.traffic_allocation,
		updated_at = now()
	returning id
)
insert into ab_variants (experiment_id, key, name, weight, config, is_control)
select
	id,
	'A',
	'Booking calendar CTA',
	50,
	'{"cta_mode":"booking_calendar"}'::jsonb,
	true
from inserted_experiment
union all
select
	id,
	'B',
	'Dual enquiry CTA',
	50,
	'{"cta_mode":"dual_buttons","primary_label":"Vortrag anfragen","secondary_label":"Verfügbarkeit prüfen"}'::jsonb,
	false
from inserted_experiment
on conflict (experiment_id, key) do update
set
	name = excluded.name,
	weight = excluded.weight,
	config = excluded.config,
	is_control = excluded.is_control;
