alter table clients
add column if not exists logo_bucket text,
add column if not exists logo_path text;

insert into
	storage.buckets (id, name, public)
values
	('client-logos', 'client-logos', true)
on conflict (id) do update
set
	public = excluded.public;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'storage'
			and tablename = 'objects'
			and policyname = 'Client logos are publicly readable'
	) then
		create policy "Client logos are publicly readable" on storage.objects for select
		to public
		using (bucket_id = 'client-logos');
	end if;
end $$;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'storage'
			and tablename = 'objects'
			and policyname = 'Authenticated users can upload client logos'
	) then
		create policy "Authenticated users can upload client logos" on storage.objects for insert
		to authenticated
		with check (bucket_id = 'client-logos');
	end if;
end $$;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'storage'
			and tablename = 'objects'
			and policyname = 'Authenticated users can update client logos'
	) then
		create policy "Authenticated users can update client logos" on storage.objects for update
		to authenticated
		using (bucket_id = 'client-logos')
		with check (bucket_id = 'client-logos');
	end if;
end $$;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'storage'
			and tablename = 'objects'
			and policyname = 'Authenticated users can delete client logos'
	) then
		create policy "Authenticated users can delete client logos" on storage.objects for delete
		to authenticated
		using (bucket_id = 'client-logos');
	end if;
end $$;
