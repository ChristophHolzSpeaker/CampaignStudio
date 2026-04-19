-- Booking module MVP phase 1 foundation: types, links, bookings, rules, settings, reschedule audit

create type booking_type as enum ('lead', 'general');
create type booking_status as enum ('confirmed', 'cancelled');
create type booking_reschedule_actor as enum ('lead', 'admin', 'system');

alter table booking_links
add column booking_type booking_type not null default 'lead';

alter table booking_links
add column metadata jsonb;

alter table booking_links
alter column lead_journey_id drop not null;

alter table booking_links
alter column campaign_id drop not null;

create table bookings (
	id uuid primary key default gen_random_uuid(),
	booking_type booking_type not null,
	lead_journey_id uuid references lead_journeys(id) on delete set null,
	email text not null,
	name text,
	company text,
	scope text not null,
	status booking_status not null default 'confirmed',
	starts_at timestamp with time zone not null,
	ends_at timestamp with time zone not null,
	google_calendar_event_id text,
	reschedule_token text,
	is_repeat_interaction boolean not null default false,
	created_at timestamp with time zone not null default now(),
	updated_at timestamp with time zone not null default now()
);

create index bookings_email_idx on bookings(email);
create index bookings_lead_journey_id_idx on bookings(lead_journey_id);
create index bookings_starts_at_idx on bookings(starts_at);
create unique index bookings_reschedule_token_key on bookings(reschedule_token);

create table booking_rules (
	id uuid primary key default gen_random_uuid(),
	booking_type booking_type not null,
	advance_notice_minutes integer not null,
	slot_duration_minutes integer not null,
	slot_interval_minutes integer not null,
	is_enabled boolean not null default true,
	created_at timestamp with time zone not null default now(),
	updated_at timestamp with time zone not null default now()
);

create unique index booking_rules_booking_type_key on booking_rules(booking_type);

create table booking_settings (
	id uuid primary key default gen_random_uuid(),
	is_paused boolean not null default false,
	pause_message text,
	created_at timestamp with time zone not null default now(),
	updated_at timestamp with time zone not null default now()
);

create table booking_reschedules (
	id uuid primary key default gen_random_uuid(),
	booking_id uuid not null references bookings(id) on delete cascade,
	old_starts_at timestamp with time zone not null,
	old_ends_at timestamp with time zone not null,
	new_starts_at timestamp with time zone not null,
	new_ends_at timestamp with time zone not null,
	changed_by booking_reschedule_actor not null,
	changed_at timestamp with time zone not null default now()
);

create index booking_reschedules_booking_id_idx on booking_reschedules(booking_id);
create index booking_reschedules_changed_at_idx on booking_reschedules(changed_at);
