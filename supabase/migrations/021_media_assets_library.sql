create table media_assets (
	id text primary key,
	kind text not null check (kind in ('image', 'video')),
	title text not null,
	description text not null,
	usage_notes text not null,
	avoid_notes text,
	primary_url text not null,
	thumbnail_url text,
	thumbnail_alt text,
	section_types text[] not null default '{}'::text[],
	topics text[] not null default '{}'::text[],
	audiences text[] not null default '{}'::text[],
	formats text[] not null default '{}'::text[],
	intent_tags text[] not null default '{}'::text[],
	is_active boolean not null default true,
	priority integer not null default 100,
	created_at timestamp with time zone default now() not null,
	updated_at timestamp with time zone default now() not null,
	constraint media_assets_id_not_blank check (length(trim(id)) > 0),
	constraint media_assets_title_not_blank check (length(trim(title)) > 0),
	constraint media_assets_primary_url_not_blank check (length(trim(primary_url)) > 0),
	constraint media_assets_video_thumbnail_required check (
		kind <> 'video'
		or (
			thumbnail_url is not null
			and length(trim(thumbnail_url)) > 0
			and thumbnail_alt is not null
			and length(trim(thumbnail_alt)) > 0
		)
	)
);

create index media_assets_active_idx on media_assets (is_active) where is_active;
create index media_assets_priority_idx on media_assets (priority);
create index media_assets_kind_idx on media_assets (kind);
create index media_assets_section_types_gin on media_assets using gin (section_types);
create index media_assets_topics_gin on media_assets using gin (topics);
create index media_assets_audiences_gin on media_assets using gin (audiences);
create index media_assets_formats_gin on media_assets using gin (formats);

insert into
	media_assets (
		id,
		kind,
		title,
		description,
		usage_notes,
		avoid_notes,
		primary_url,
		thumbnail_url,
		thumbnail_alt,
		section_types,
		topics,
		audiences,
		formats,
		intent_tags,
		priority
	)
values
	(
		'hero-executive-stage-ai-strategy-v1',
		'video',
		'Executive keynote stage reel',
		'High-authority keynote footage focused on strategic AI transformation themes.',
		'Use when the campaign needs immediate executive credibility and strategic positioning.',
		'Avoid for informal workshop or small-room collaboration messaging.',
		'https://www.youtube.com/watch?v=mpbtCg2NSUs',
		'https://cdn.prod.website-files.com/61263e0de406f497361dca55/6130408552ea140d707aab8e_christoph-contact-bg.jpg',
		'Christoph Holz speaking on stage to an executive audience',
		array['immediate_authority_hero'],
		array['ai strategy', 'digital transformation', 'executive leadership'],
		array['IT Companies', 'Banks', 'Associations'],
		array['Morning Keynote', 'Endnote', 'Business Breakfast'],
		array['authority', 'credibility', 'enterprise'],
		10
	),
	(
		'hero-innovation-forum-q-and-a-v1',
		'video',
		'Innovation forum segment',
		'Conference clip with a practical innovation angle and audience engagement context.',
		'Use when messaging emphasizes applied innovation and pragmatic implementation.',
		'Avoid for campaigns centered on conservative governance-only topics.',
		'https://www.youtube.com/watch?v=mpbtCg2NSUs',
		'https://images.unsplash.com/photo-1552664730-d307ca884978',
		'Conference panel stage with a presenter addressing a business audience',
		array['immediate_authority_hero'],
		array['innovation', 'applied ai', 'operations'],
		array['IT Companies', 'Associations'],
		array['Panel Moderation', 'Business Breakfast', 'Endnote'],
		array['innovation', 'practicality', 'momentum'],
		20
	),
	(
		'hero-enterprise-ops-focus-v1',
		'video',
		'Enterprise operations keynote reel',
		'Executive talk framing AI through operational outcomes and leadership decisions.',
		'Use when conversion intent prioritizes execution, alignment, and measurable outcomes.',
		'Avoid for highly inspirational brand-story campaigns without operational focus.',
		'https://www.youtube.com/watch?v=mpbtCg2NSUs',
		'https://images.unsplash.com/photo-1517048676732-d65bc937f952',
		'Business audience listening to a speaker during a strategy session',
		array['immediate_authority_hero'],
		array['operations', 'execution', 'leadership'],
		array['Banks', 'IT Companies'],
		array['Morning Keynote', 'Dinner Speech'],
		array['trust', 'execution', 'commercial credibility'],
		30
	),
	(
		'hybrid-ai-roadmap-visual-v1',
		'image',
		'AI roadmap workshop board',
		'Collaborative planning board that visualizes phased AI implementation.',
		'Use for sections explaining structured rollout plans and strategic sequencing.',
		null,
		'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40',
		null,
		null,
		array['hybrid_content_section'],
		array['implementation', 'roadmap', 'transformation'],
		array['IT Companies', 'Banks', 'Associations'],
		array['Morning Keynote', 'Business Breakfast', 'Panel Moderation'],
		array['clarity', 'strategy', 'execution'],
		40
	),
	(
		'hybrid-executive-discussion-v1',
		'image',
		'Executive alignment discussion',
		'Leadership group in an active strategy discussion setting.',
		'Use for messaging focused on alignment, buy-in, and decision quality.',
		null,
		'https://images.unsplash.com/photo-1552664730-d307ca884978',
		null,
		null,
		array['hybrid_content_section'],
		array['leadership', 'alignment', 'decision-making'],
		array['Banks', 'IT Companies', 'Associations'],
		array['Panel Moderation', 'Endnote', 'Dinner Speech'],
		array['trust', 'alignment', 'authority'],
		50
	),
	(
		'hybrid-future-tech-stage-v1',
		'image',
		'Future technology keynote scene',
		'Visual emphasizing modern technology context and forward-looking narrative.',
		'Use for future-oriented messaging and innovation momentum sections.',
		'Avoid when campaign tone is strictly compliance or policy-centric.',
		'https://images.unsplash.com/photo-1475721027785-f74eccf877e2',
		null,
		null,
		array['hybrid_content_section'],
		array['future trends', 'innovation', 'ai vision'],
		array['IT Companies', 'Associations'],
		array['Morning Keynote', 'Endnote'],
		array['inspiration', 'innovation', 'momentum'],
		60
	)
on conflict (id) do update
set
	kind = excluded.kind,
	title = excluded.title,
	description = excluded.description,
	usage_notes = excluded.usage_notes,
	avoid_notes = excluded.avoid_notes,
	primary_url = excluded.primary_url,
	thumbnail_url = excluded.thumbnail_url,
	thumbnail_alt = excluded.thumbnail_alt,
	section_types = excluded.section_types,
	topics = excluded.topics,
	audiences = excluded.audiences,
	formats = excluded.formats,
	intent_tags = excluded.intent_tags,
	priority = excluded.priority,
	updated_at = now();
