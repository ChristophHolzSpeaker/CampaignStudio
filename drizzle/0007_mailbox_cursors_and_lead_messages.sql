-- Gmail ingestion foundation: mailbox cursor state and persisted lead messages

create table mailbox_cursors (
	id uuid primary key default gen_random_uuid(),
	gmail_user text not null,
	last_processed_history_id text not null,
	watch_expiration timestamp with time zone not null,
	last_watch_renewed_at timestamp with time zone,
	last_push_received_at timestamp with time zone,
	last_sync_at timestamp with time zone,
	sync_status text not null default 'idle',
	created_at timestamp with time zone default now() not null,
	updated_at timestamp with time zone default now() not null
);

create unique index mailbox_cursors_gmail_user_key on mailbox_cursors(gmail_user);

create table lead_messages (
	id uuid primary key default gen_random_uuid(),
	lead_journey_id uuid not null references lead_journeys(id) on delete cascade,
	direction text not null,
	provider text not null default 'gmail',
	provider_message_id text not null,
	provider_thread_id text not null,
	from_email text not null,
	to_email text not null,
	subject text not null,
	body_text text not null,
	body_html text,
	classification text,
	classification_confidence real,
	auto_response_decision text,
	auto_response_sent_at timestamp with time zone,
	received_at timestamp with time zone,
	sent_at timestamp with time zone,
	raw_metadata jsonb not null default '{}'::jsonb,
	created_at timestamp with time zone default now() not null,
	updated_at timestamp with time zone default now() not null
);

create unique index lead_messages_provider_message_id_key on lead_messages(provider_message_id);
create index lead_messages_provider_thread_id_idx on lead_messages(provider_thread_id);
create index lead_messages_lead_journey_id_idx on lead_messages(lead_journey_id);
create index lead_messages_received_at_idx on lead_messages(received_at);
create index lead_messages_sent_at_idx on lead_messages(sent_at);
