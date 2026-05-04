create table keynotes (
	id text primary key,
	keynote_title text not null,
	keynote_summary text not null,
	image_url text not null,
	image_alt text not null,
	audiences text[] not null default '{}'::text[],
	topics text[] not null default '{}'::text[],
	formats text[] not null default '{}'::text[],
	geographies text[] not null default '{}'::text[],
	intent_tags text[] not null default '{}'::text[],
	is_active boolean not null default true,
	priority integer not null default 100,
	created_at timestamp with time zone default now() not null,
	updated_at timestamp with time zone default now() not null,
	constraint keynotes_id_not_blank check (length(trim(id)) > 0),
	constraint keynotes_title_not_blank check (length(trim(keynote_title)) > 0),
	constraint keynotes_summary_not_blank check (length(trim(keynote_summary)) > 0),
	constraint keynotes_image_url_not_blank check (length(trim(image_url)) > 0),
	constraint keynotes_image_alt_not_blank check (length(trim(image_alt)) > 0)
);

create index keynotes_active_idx on keynotes (is_active) where is_active;
create index keynotes_priority_idx on keynotes (priority);
create index keynotes_audiences_gin on keynotes using gin (audiences);
create index keynotes_topics_gin on keynotes using gin (topics);
create index keynotes_formats_gin on keynotes using gin (formats);
create index keynotes_geographies_gin on keynotes using gin (geographies);
create index keynotes_intent_tags_gin on keynotes using gin (intent_tags);

insert into
	keynotes (
		id,
		keynote_title,
		keynote_summary,
		image_url,
		image_alt,
		audiences,
		topics,
		formats,
		geographies,
		intent_tags,
		priority
	)
values
	(
		'keynote-digital-humanism-chatgpt',
		'Digital Humanism or ChatGPT - what remains?',
		'Digitalization teaches us more than anything else what it means to be human. Digital humanism is the conviction that if an activity can be digitized, it is not ultimately intended for human use. If everything inhuman is digitized, what remains is humanity: ethics, empathy, and personal responsibility. Or is artificial intelligence ultimately just another human being?',
		'https://images.unsplash.com/photo-1544536871-6fcffa8f46f9',
		'Christoph looking into a globe during a keynote',
		array['Executive Teams', 'Transformation Leaders'],
		array['digital humanism', 'ai ethics', 'leadership'],
		array['Morning Keynote', 'Executive Summit'],
		array['DACH', 'Europe'],
		array['ethics', 'future trends', 'decision making'],
		10
	),
	(
		'keynote-ai-decision-advantage',
		'AI Decision Advantage for Leaders',
		'A practical keynote on how leadership teams can use AI to make faster, better decisions without outsourcing accountability.',
		'https://images.unsplash.com/photo-1552664730-d307ca884978',
		'Business audience listening to an AI strategy keynote',
		array['Executive Teams', 'Operations Leaders'],
		array['ai strategy', 'operations', 'decision making'],
		array['Business Breakfast', 'Panel Moderation'],
		array['Europe', 'Global'],
		array['execution', 'clarity', 'commercial credibility'],
		20
	),
	(
		'keynote-human-centered-transformation',
		'Human-Centered Transformation at Scale',
		'How to redesign organizations around technology shifts while keeping trust, culture, and human responsibility at the center.',
		'https://images.unsplash.com/photo-1475721027785-f74eccf877e2',
		'Stage keynote with futuristic visual backdrop',
		array['Transformation Teams', 'People Leaders'],
		array['transformation', 'culture', 'leadership'],
		array['Endnote', 'Morning Keynote'],
		array['DACH', 'Europe'],
		array['change', 'humanity', 'strategy'],
		30
	)
on conflict (id) do update
set
	keynote_title = excluded.keynote_title,
	keynote_summary = excluded.keynote_summary,
	image_url = excluded.image_url,
	image_alt = excluded.image_alt,
	audiences = excluded.audiences,
	topics = excluded.topics,
	formats = excluded.formats,
	geographies = excluded.geographies,
	intent_tags = excluded.intent_tags,
	priority = excluded.priority,
	updated_at = now();
