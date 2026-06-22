create table public_api_rate_limits (
	id serial primary key,
	token_fingerprint text not null,
	window_name text not null,
	window_start timestamp not null,
	request_count integer not null default 0,
	created_at timestamp not null default now(),
	updated_at timestamp not null default now()
);

create unique index public_api_rate_limits_window_unique_idx
	on public_api_rate_limits (token_fingerprint, window_name, window_start);

create index public_api_rate_limits_window_start_idx
	on public_api_rate_limits (window_start);
