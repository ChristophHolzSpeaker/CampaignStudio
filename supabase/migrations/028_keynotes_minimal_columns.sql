drop index if exists keynotes_priority_idx;
drop index if exists keynotes_audiences_gin;
drop index if exists keynotes_topics_gin;
drop index if exists keynotes_formats_gin;
drop index if exists keynotes_geographies_gin;
drop index if exists keynotes_intent_tags_gin;

alter table keynotes
	drop column if exists audiences,
	drop column if exists topics,
	drop column if exists formats,
	drop column if exists geographies,
	drop column if exists intent_tags,
	drop column if exists priority;
