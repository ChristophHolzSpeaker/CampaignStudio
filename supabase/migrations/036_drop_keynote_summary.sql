begin;

update public.keynotes
set keynote_short = coalesce(nullif(trim(keynote_short), ''), keynote_summary)
where keynote_summary is not null;

alter table public.keynotes
drop column if exists keynote_summary;

commit;
