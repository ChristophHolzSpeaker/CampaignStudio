create table clients (
	id text primary key,
	name text not null,
	logo_url text not null,
	logo_alt text not null,
	industry text not null,
	keynote_case_study text not null,
	audiences text[] not null default '{}'::text[],
	topics text[] not null default '{}'::text[],
	formats text[] not null default '{}'::text[],
	geographies text[] not null default '{}'::text[],
	intent_tags text[] not null default '{}'::text[],
	is_active boolean not null default true,
	priority integer not null default 100,
	created_at timestamp with time zone default now() not null,
	updated_at timestamp with time zone default now() not null,
	constraint clients_id_not_blank check (length(trim(id)) > 0),
	constraint clients_name_not_blank check (length(trim(name)) > 0),
	constraint clients_logo_url_not_blank check (length(trim(logo_url)) > 0),
	constraint clients_logo_alt_not_blank check (length(trim(logo_alt)) > 0),
	constraint clients_industry_not_blank check (length(trim(industry)) > 0),
	constraint clients_keynote_case_study_not_blank check (length(trim(keynote_case_study)) > 0)
);

create index clients_active_idx on clients (is_active) where is_active;
create index clients_industry_idx on clients (industry);
create index clients_priority_idx on clients (priority);
create index clients_audiences_gin on clients using gin (audiences);
create index clients_topics_gin on clients using gin (topics);
create index clients_formats_gin on clients using gin (formats);
create index clients_geographies_gin on clients using gin (geographies);
create index clients_intent_tags_gin on clients using gin (intent_tags);

insert into
	clients (
		id,
		name,
		logo_url,
		logo_alt,
		industry,
		keynote_case_study,
		audiences,
		topics,
		formats,
		geographies,
		intent_tags,
		priority
	)
values
	(
		'client-redbull',
		'Redbull',
		'/redbull-logo-svgrepo-com.svg',
		'Redbull logo',
		'Consumer Products',
		'Keynote on AI-driven brand innovation and high-velocity decision making for regional marketing and leadership teams.',
		array['CMO Teams', 'Regional Leadership', 'Brand Strategy'],
		array['innovation', 'digital transformation', 'leadership'],
		array['Morning Keynote', 'Endnote'],
		array['DACH', 'Europe'],
		array['innovation', 'momentum', 'commercial credibility'],
		20
	),
	(
		'client-google',
		'Google',
		'/68231e19a6b5c7afb9fdbf99_Google_2015_logo.svg.webp',
		'Google logo',
		'Technology',
		'Executive keynote on practical AI adoption, product acceleration, and cross-functional operating models at enterprise scale.',
		array['Executive Teams', 'Product Leaders', 'Technology Leaders'],
		array['ai strategy', 'applied ai', 'operations'],
		array['Panel Moderation', 'Business Breakfast', 'Morning Keynote'],
		array['Global', 'Europe'],
		array['authority', 'execution', 'enterprise'],
		10
	),
	(
		'client-atos',
		'Atos',
		'/68231e18e79c638d8f3661bb_Atos.svg',
		'Atos logo',
		'IT Services',
		'Conference keynote focused on AI in enterprise operations, governance, and measurable modernization outcomes.',
		array['IT Leadership', 'Operations Leaders', 'Transformation Teams'],
		array['operations', 'governance', 'transformation'],
		array['Business Breakfast', 'Panel Moderation', 'Dinner Speech'],
		array['DACH', 'Europe'],
		array['trust', 'execution', 'enterprise'],
		30
	),
	(
		'client-bmw-group',
		'BMW Group',
		'/68231e4f2fdb78ace3f120ee_BMW_Group.svg',
		'BMW Group logo',
		'Automotive',
		'Leadership keynote on industrial AI, intelligent automation, and the human side of transformation in complex organizations.',
		array['Board Members', 'Operations Leaders', 'Innovation Teams'],
		array['automation', 'innovation', 'leadership'],
		array['Morning Keynote', 'Endnote'],
		array['DACH', 'Europe'],
		array['credibility', 'future trends', 'execution'],
		40
	),
	(
		'client-eurobank-group',
		'EuroBank Group',
		'/cisco-svgrepo-com.svg',
		'EuroBank Group logo placeholder',
		'Banking',
		'Banking-sector keynote covering AI risk governance, regulatory readiness, and practical use-case prioritization across retail and corporate banking.',
		array['Banking Executives', 'Risk Leaders', 'Compliance Leaders'],
		array['banking', 'risk governance', 'regulatory readiness', 'ai strategy'],
		array['Executive Summit', 'Business Breakfast', 'Panel Moderation'],
		array['Europe', 'DACH'],
		array['compliance', 'risk', 'trust', 'enterprise'],
		15
	)
on conflict (id) do update
set
	name = excluded.name,
	logo_url = excluded.logo_url,
	logo_alt = excluded.logo_alt,
	industry = excluded.industry,
	keynote_case_study = excluded.keynote_case_study,
	audiences = excluded.audiences,
	topics = excluded.topics,
	formats = excluded.formats,
	geographies = excluded.geographies,
	intent_tags = excluded.intent_tags,
	priority = excluded.priority,
	updated_at = now();
