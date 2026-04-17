import {
	pgTable,
	serial,
	integer,
	text,
	timestamp,
	jsonb,
	boolean,
	uuid,
	real,
	index,
	uniqueIndex,
	pgView,
	type AnyPgColumn,
	pgEnum
} from 'drizzle-orm/pg-core';

export const booking_type = pgEnum('booking_type', ['lead', 'general']);
export const booking_status = pgEnum('booking_status', ['confirmed', 'cancelled']);
export const booking_reschedule_actor = pgEnum('booking_reschedule_actor', [
	'lead',
	'admin',
	'system'
]);

export const campaigns = pgTable('campaigns', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	audience: text('audience').notNull(),
	format: text('format').notNull(),
	topic: text('topic').notNull(),
	language: text('language').notNull(),
	geography: text('geography').notNull(),
	notes: text('notes'),
	status: text('status').notNull().default('draft'),
	created_at: timestamp('created_at').notNull().defaultNow(),
	updated_at: timestamp('updated_at').notNull().defaultNow(),
	created_by: text('created_by') // Could reference user ID from auth system
});

export const campaign_pages = pgTable('campaign_pages', {
	id: serial('id').primaryKey(),
	campaign_id: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id),
	version_number: integer('version_number').notNull().default(1),
	structured_content_json: jsonb('structured_content_json').notNull(),
	slug: text('slug').notNull(),
	is_published: boolean('is_published').notNull().default(false),
	published_at: timestamp('published_at'),
	created_at: timestamp('created_at').notNull().defaultNow(),
	updated_at: timestamp('updated_at').notNull().defaultNow()
});

export const campaign_visits = pgTable('campaign_visits', {
	id: serial('id').primaryKey(),
	campaign_id: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id),
	campaign_page_id: integer('campaign_page_id').references(() => campaign_pages.id),
	slug: text('slug').notNull(),
	visited_at: timestamp('visited_at').notNull().defaultNow(),
	referrer: text('referrer'),
	utm_source: text('utm_source'),
	utm_medium: text('utm_medium'),
	utm_campaign: text('utm_campaign'),
	utm_term: text('utm_term'),
	utm_content: text('utm_content'),
	user_agent: text('user_agent'),
	ip_hash_or_session_identifier: text('ip_hash_or_session_identifier')
});

export const campaign_visit_metrics = pgView('campaign_visit_metrics', {
	campaign_id: integer('campaign_id'),
	visit_count: integer('visit_count'),
	unique_visitor_count: integer('unique_visitor_count'),
	last_visited_at: timestamp('last_visited_at')
}).existing();

export const generation_jobs = pgTable('generation_jobs', {
	id: serial('id').primaryKey(),
	campaign_id: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id),
	status: text('status').notNull().default('pending'), // pending, processing, completed, failed
	input_payload: jsonb('input_payload'),
	output_payload: jsonb('output_payload'),
	error_message: text('error_message'),
	created_at: timestamp('created_at').notNull().defaultNow(),
	completed_at: timestamp('completed_at')
});

export const campaign_ad_packages = pgTable('campaign_ad_packages', {
	id: serial('id').primaryKey(),
	campaign_id: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id),
	version_number: integer('version_number').notNull().default(1),
	channel: text('channel').notNull().default('google_ads_search'),
	status: text('status').notNull().default('draft'),
	strategy_json: jsonb('strategy_json').notNull().default({}),
	created_at: timestamp('created_at').notNull().defaultNow(),
	updated_at: timestamp('updated_at').notNull().defaultNow()
});

export const campaign_ad_groups = pgTable('campaign_ad_groups', {
	id: serial('id').primaryKey(),
	ad_package_id: integer('ad_package_id')
		.notNull()
		.references(() => campaign_ad_packages.id),
	campaign_page_id: integer('campaign_page_id').references(() => campaign_pages.id),
	name: text('name').notNull(),
	intent_summary: text('intent_summary'),
	position: integer('position').notNull().default(0),
	created_at: timestamp('created_at').notNull().defaultNow(),
	updated_at: timestamp('updated_at').notNull().defaultNow()
});

export const campaign_keywords = pgTable('campaign_keywords', {
	id: serial('id').primaryKey(),
	ad_group_id: integer('ad_group_id')
		.notNull()
		.references(() => campaign_ad_groups.id),
	keyword_text: text('keyword_text').notNull(),
	match_type: text('match_type').notNull(),
	is_negative: boolean('is_negative').notNull().default(false),
	rationale: text('rationale'),
	position: integer('position').notNull().default(0),
	created_at: timestamp('created_at').notNull().defaultNow(),
	updated_at: timestamp('updated_at').notNull().defaultNow()
});

export const campaign_ads = pgTable('campaign_ads', {
	id: serial('id').primaryKey(),
	ad_group_id: integer('ad_group_id')
		.notNull()
		.references(() => campaign_ad_groups.id),
	ad_type: text('ad_type').notNull().default('responsive_search_ad'),
	headlines_json: jsonb('headlines_json').notNull().default([]),
	descriptions_json: jsonb('descriptions_json').notNull().default([]),
	path_1: text('path_1'),
	path_2: text('path_2'),
	created_at: timestamp('created_at').notNull().defaultNow(),
	updated_at: timestamp('updated_at').notNull().defaultNow()
});

export const lead_journeys = pgTable(
	'lead_journeys',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		campaign_id: integer('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
		campaign_page_id: integer('campaign_page_id').references(() => campaign_pages.id, {
			onDelete: 'set null'
		}),
		first_touch_type: text('first_touch_type').notNull(),
		first_touch_at: timestamp('first_touch_at').notNull().defaultNow(),
		contact_email: text('contact_email'),
		contact_name: text('contact_name'),
		current_stage: text('current_stage').notNull().default('new'),
		hubspot_contact_id: text('hubspot_contact_id'),
		hubspot_deal_id: text('hubspot_deal_id'),
		auto_response_sent_at: timestamp('auto_response_sent_at'),
		auto_response_message_id: uuid('auto_response_message_id').references(
			(): AnyPgColumn => lead_messages.id,
			{
				onDelete: 'set null'
			}
		),
		outcome: text('outcome'),
		created_at: timestamp('created_at').notNull().defaultNow(),
		updated_at: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => ({
		journeyLookupIdx: index('lead_journeys_contact_campaign_updated_idx').on(
			table.contact_email,
			table.campaign_id,
			table.updated_at
		),
		journeyStageIdx: index('lead_journeys_stage_idx').on(table.current_stage)
	})
);

export const lead_events = pgTable(
	'lead_events',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		lead_journey_id: uuid('lead_journey_id').references(() => lead_journeys.id, {
			onDelete: 'set null'
		}),
		campaign_id: integer('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
		campaign_page_id: integer('campaign_page_id').references(() => campaign_pages.id, {
			onDelete: 'set null'
		}),
		event_type: text('event_type').notNull(),
		event_source: text('event_source').notNull(),
		event_payload: jsonb('event_payload').notNull().default({}),
		session_id: text('session_id'),
		anonymous_id: text('anonymous_id'),
		occurred_at: timestamp('occurred_at').notNull().defaultNow()
	},
	(table) => ({
		eventJourneyOccurredIdx: index('lead_events_journey_occurred_idx').on(
			table.lead_journey_id,
			table.occurred_at
		),
		eventCampaignPageOccurredIdx: index('lead_events_campaign_page_occurred_idx').on(
			table.campaign_id,
			table.campaign_page_id,
			table.occurred_at
		),
		eventSessionIdx: index('lead_events_session_idx').on(table.session_id),
		eventAnonymousIdx: index('lead_events_anonymous_idx').on(table.anonymous_id)
	})
);

export const booking_links = pgTable(
	'booking_links',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		lead_journey_id: uuid('lead_journey_id').references((): AnyPgColumn => lead_journeys.id, {
			onDelete: 'cascade'
		}),
		campaign_id: integer('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }),
		token: text('token').notNull(),
		booking_type: booking_type('booking_type').notNull().default('lead'),
		expires_at: timestamp('expires_at').notNull(),
		clicked_at: timestamp('clicked_at'),
		booked_at: timestamp('booked_at'),
		metadata: jsonb('metadata'),
		created_at: timestamp('created_at').notNull().defaultNow(),
		updated_at: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => ({
		tokenUniqueIdx: uniqueIndex('booking_links_token_key').on(table.token),
		expiresAtIdx: index('booking_links_expires_at_idx').on(table.expires_at)
	})
);

export const bookings = pgTable(
	'bookings',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		booking_type: booking_type('booking_type').notNull(),
		lead_journey_id: uuid('lead_journey_id').references((): AnyPgColumn => lead_journeys.id, {
			onDelete: 'set null'
		}),
		email: text('email').notNull(),
		name: text('name'),
		company: text('company'),
		scope: text('scope').notNull(),
		status: booking_status('status').notNull().default('confirmed'),
		starts_at: timestamp('starts_at').notNull(),
		ends_at: timestamp('ends_at').notNull(),
		google_calendar_event_id: text('google_calendar_event_id'),
		reschedule_token: text('reschedule_token'),
		is_repeat_interaction: boolean('is_repeat_interaction').notNull().default(false),
		created_at: timestamp('created_at').notNull().defaultNow(),
		updated_at: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => ({
		emailIdx: index('bookings_email_idx').on(table.email),
		leadJourneyIdx: index('bookings_lead_journey_id_idx').on(table.lead_journey_id),
		startsAtIdx: index('bookings_starts_at_idx').on(table.starts_at),
		rescheduleTokenUniqueIdx: uniqueIndex('bookings_reschedule_token_key').on(
			table.reschedule_token
		)
	})
);

export const booking_rules = pgTable(
	'booking_rules',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		booking_type: booking_type('booking_type').notNull(),
		advance_notice_minutes: integer('advance_notice_minutes').notNull(),
		slot_duration_minutes: integer('slot_duration_minutes').notNull(),
		slot_interval_minutes: integer('slot_interval_minutes').notNull(),
		is_enabled: boolean('is_enabled').notNull().default(true),
		created_at: timestamp('created_at').notNull().defaultNow(),
		updated_at: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => ({
		bookingTypeUniqueIdx: uniqueIndex('booking_rules_booking_type_key').on(table.booking_type)
	})
);

export const booking_settings = pgTable('booking_settings', {
	id: uuid('id').defaultRandom().primaryKey(),
	is_paused: boolean('is_paused').notNull().default(false),
	pause_message: text('pause_message'),
	created_at: timestamp('created_at').notNull().defaultNow(),
	updated_at: timestamp('updated_at').notNull().defaultNow()
});

export const booking_reschedules = pgTable(
	'booking_reschedules',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		booking_id: uuid('booking_id')
			.notNull()
			.references(() => bookings.id, { onDelete: 'cascade' }),
		old_starts_at: timestamp('old_starts_at').notNull(),
		old_ends_at: timestamp('old_ends_at').notNull(),
		new_starts_at: timestamp('new_starts_at').notNull(),
		new_ends_at: timestamp('new_ends_at').notNull(),
		changed_by: booking_reschedule_actor('changed_by').notNull(),
		changed_at: timestamp('changed_at').notNull().defaultNow()
	},
	(table) => ({
		bookingIdIdx: index('booking_reschedules_booking_id_idx').on(table.booking_id),
		changedAtIdx: index('booking_reschedules_changed_at_idx').on(table.changed_at)
	})
);

export const mailbox_cursors = pgTable(
	'mailbox_cursors',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		gmail_user: text('gmail_user').notNull(),
		last_processed_history_id: text('last_processed_history_id').notNull(),
		watch_expiration: timestamp('watch_expiration').notNull(),
		last_watch_renewed_at: timestamp('last_watch_renewed_at'),
		last_push_received_at: timestamp('last_push_received_at'),
		last_sync_at: timestamp('last_sync_at'),
		sync_status: text('sync_status').notNull().default('idle'),
		created_at: timestamp('created_at').notNull().defaultNow(),
		updated_at: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => ({
		gmailUserUniqueIdx: uniqueIndex('mailbox_cursors_gmail_user_key').on(table.gmail_user)
	})
);

export const lead_messages = pgTable(
	'lead_messages',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		lead_journey_id: uuid('lead_journey_id')
			.notNull()
			.references(() => lead_journeys.id, { onDelete: 'cascade' }),
		direction: text('direction').notNull(),
		provider: text('provider').notNull().default('gmail'),
		provider_message_id: text('provider_message_id').notNull(),
		provider_thread_id: text('provider_thread_id').notNull(),
		from_email: text('from_email').notNull(),
		to_email: text('to_email').notNull(),
		subject: text('subject').notNull(),
		body_text: text('body_text').notNull(),
		body_html: text('body_html'),
		classification: text('classification'),
		classification_confidence: real('classification_confidence'),
		auto_response_decision: text('auto_response_decision'),
		auto_response_sent_at: timestamp('auto_response_sent_at'),
		received_at: timestamp('received_at'),
		sent_at: timestamp('sent_at'),
		raw_metadata: jsonb('raw_metadata').notNull().default({}),
		created_at: timestamp('created_at').notNull().defaultNow(),
		updated_at: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => ({
		providerMessageUniqueIdx: uniqueIndex('lead_messages_provider_message_id_key').on(
			table.provider_message_id
		),
		journeyIdx: index('lead_messages_lead_journey_id_idx').on(table.lead_journey_id),
		threadIdx: index('lead_messages_provider_thread_id_idx').on(table.provider_thread_id),
		receivedAtIdx: index('lead_messages_received_at_idx').on(table.received_at),
		sentAtIdx: index('lead_messages_sent_at_idx').on(table.sent_at)
	})
);

export const prompts = pgTable('prompts', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	purpose: text('purpose').notNull(),
	audience: text('audience').notNull(),
	format: text('format').notNull(),
	topic: text('topic').notNull().default(''),
	model: text('model').notNull(),
	system_prompt: text('system_prompt').notNull(),
	user_prompt_template: text('user_prompt_template').notNull(),
	metadata: jsonb('metadata'),
	is_active: boolean('is_active').notNull().default(true),
	created_at: timestamp('created_at').notNull().defaultNow(),
	updated_at: timestamp('updated_at').notNull().defaultNow()
});

// Keep the old task table for now (can be removed later)
export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

// Temporarily commented out until auth schema is generated
// export * from './auth.schema';
