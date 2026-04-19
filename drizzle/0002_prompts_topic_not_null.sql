-- Ensure prompts.topic always has a value so uniqueness on audience+format works reliably
alter table prompts
	alter column topic set default '';

update prompts
	set topic = ''
	where topic is null;

alter table prompts
	alter column topic set not null;

drop index if exists prompts_unique_key;
create unique index prompts_unique_key on prompts (purpose, audience, format, topic);
