alter table if exists clients rename to logos;

alter index if exists clients_active_idx rename to logos_active_idx;
alter index if exists clients_priority_idx rename to logos_priority_idx;
drop index if exists clients_industry_idx;
drop index if exists clients_audiences_gin;
drop index if exists clients_topics_gin;
drop index if exists clients_formats_gin;
drop index if exists clients_geographies_gin;
drop index if exists clients_intent_tags_gin;

alter table logos
	drop constraint if exists clients_industry_not_blank,
	drop constraint if exists clients_keynote_case_study_not_blank,
	drop column if exists industry,
	drop column if exists keynote_case_study,
	drop column if exists audiences,
	drop column if exists topics,
	drop column if exists formats,
	drop column if exists geographies,
	drop column if exists intent_tags;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'logos_id_not_blank'
	) then
		alter table logos
			add constraint logos_id_not_blank check (length(trim(id)) > 0);
	end if;
end $$;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'logos_name_not_blank'
	) then
		alter table logos
			add constraint logos_name_not_blank check (length(trim(name)) > 0);
	end if;
end $$;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'logos_logo_url_not_blank'
	) then
		alter table logos
			add constraint logos_logo_url_not_blank check (length(trim(logo_url)) > 0);
	end if;
end $$;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'logos_logo_alt_not_blank'
	) then
		alter table logos
			add constraint logos_logo_alt_not_blank check (length(trim(logo_alt)) > 0);
	end if;
end $$;
