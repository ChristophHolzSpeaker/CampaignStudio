alter table keynotes
add column if not exists image_bucket text,
add column if not exists image_path text;

insert into
	storage.buckets (id, name, public)
values
	('keynote-images', 'keynote-images', true)
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
			and policyname = 'Keynote images are publicly readable'
	) then
		create policy "Keynote images are publicly readable" on storage.objects for select
		to public
		using (bucket_id = 'keynote-images');
	end if;
end $$;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'storage'
			and tablename = 'objects'
			and policyname = 'Authenticated users can upload keynote images'
	) then
		create policy "Authenticated users can upload keynote images" on storage.objects for insert
		to authenticated
		with check (bucket_id = 'keynote-images');
	end if;
end $$;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'storage'
			and tablename = 'objects'
			and policyname = 'Authenticated users can update keynote images'
	) then
		create policy "Authenticated users can update keynote images" on storage.objects for update
		to authenticated
		using (bucket_id = 'keynote-images')
		with check (bucket_id = 'keynote-images');
	end if;
end $$;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'storage'
			and tablename = 'objects'
			and policyname = 'Authenticated users can delete keynote images'
	) then
		create policy "Authenticated users can delete keynote images" on storage.objects for delete
		to authenticated
		using (bucket_id = 'keynote-images');
	end if;
end $$;
