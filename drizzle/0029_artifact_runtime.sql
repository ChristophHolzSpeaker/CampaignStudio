do $$
begin
	if not exists (select 1 from pg_type where typname = 'page_renderer_type') then
		create type page_renderer_type as enum ('sections', 'artifact');
	end if;
	if not exists (select 1 from pg_type where typname = 'artifact_upload_status') then
		create type artifact_upload_status as enum ('pending', 'uploaded', 'finalizing', 'finalized', 'failed');
	end if;
end $$;

alter table campaign_pages
	add column if not exists renderer_type page_renderer_type not null default 'sections',
	alter column structured_content_json drop not null;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'campaign_pages_renderer_content_check'
			and conrelid = 'public.campaign_pages'::regclass
	) then
		alter table campaign_pages
			add constraint campaign_pages_renderer_content_check
			check (
				(renderer_type = 'sections' and structured_content_json is not null)
				or (renderer_type = 'artifact' and structured_content_json is null)
			);
	end if;
end $$;

create table if not exists artifact_upload_sessions (
	id uuid primary key default gen_random_uuid(),
	campaign_id integer not null references campaigns(id) on delete cascade,
	slug text not null,
	status artifact_upload_status not null default 'pending',
	error_json jsonb,
	finalized_campaign_page_id integer references campaign_pages(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	expires_at timestamptz not null
);

create index if not exists artifact_upload_sessions_campaign_id_idx
	on artifact_upload_sessions (campaign_id);
create index if not exists artifact_upload_sessions_finalized_page_id_idx
	on artifact_upload_sessions (finalized_campaign_page_id);
create index if not exists artifact_upload_sessions_status_expires_idx
	on artifact_upload_sessions (status, expires_at);

create table if not exists artifact_upload_files (
	id uuid primary key default gen_random_uuid(),
	upload_session_id uuid not null references artifact_upload_sessions(id) on delete cascade,
	path text not null,
	media_type text not null,
	byte_size integer not null,
	sha256 text not null,
	storage_path text not null,
	created_at timestamptz not null default now(),
	constraint artifact_upload_files_byte_size_check check (byte_size > 0),
	constraint artifact_upload_files_sha256_check check (char_length(sha256) = 64)
);

create index if not exists artifact_upload_files_session_id_idx
	on artifact_upload_files (upload_session_id);
create unique index if not exists artifact_upload_files_session_path_unique_idx
	on artifact_upload_files (upload_session_id, path);

create table if not exists page_artifacts (
	id uuid primary key default gen_random_uuid(),
	campaign_page_id integer not null references campaign_pages(id) on delete cascade,
	source_bucket text not null,
	source_path text not null,
	asset_bucket text not null,
	asset_prefix text not null,
	entrypoint text not null default 'index.html',
	manifest_json jsonb not null,
	content_sha256 text not null,
	runtime_version text not null default 'v1',
	created_at timestamptz not null default now(),
	constraint page_artifacts_entrypoint_check check (entrypoint = 'index.html'),
	constraint page_artifacts_content_sha256_check check (char_length(content_sha256) = 64)
);

create unique index if not exists page_artifacts_campaign_page_id_unique_idx
	on page_artifacts (campaign_page_id);
create index if not exists page_artifacts_content_sha256_idx
	on page_artifacts (content_sha256);

insert into storage.buckets (id, name, public)
values
	('page-artifact-source', 'page-artifact-source', false),
	('page-artifact-assets', 'page-artifact-assets', true)
on conflict (id) do update
set public = excluded.public;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'storage'
			and tablename = 'objects'
			and policyname = 'Artifact assets are publicly readable'
	) then
		create policy "Artifact assets are publicly readable" on storage.objects
			for select to public
			using (bucket_id = 'page-artifact-assets');
	end if;
end $$;
