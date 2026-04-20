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
import { sql } from 'drizzle-orm';

export const booking_type = pgEnum('booking_type', ['lead', 'general']);
export const booking_status = pgEnum('booking_status', [
	'pending_calendar_sync',
	'confirmed',
	'calendar_sync_failed',
	'cancelled'
]);
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

export const vw_visit_enriched = pgView('vw_visit_enriched', {
	visit_id: integer('visit_id'),
	visited_at: timestamp('visited_at'),
	campaign_id: integer('campaign_id'),
	campaign_name: text('campaign_name'),
	page_id: integer('page_id'),
	page_slug: text('page_slug'),
	visit_slug: text('visit_slug'),
	visitor_identifier: text('visitor_identifier'),
	utm_source: text('utm_source'),
	utm_medium: text('utm_medium'),
	utm_campaign: text('utm_campaign'),
	utm_term: text('utm_term'),
	utm_content: text('utm_content'),
	referrer: text('referrer'),
	user_agent: text('user_agent')
}).existing();

export const vw_lead_journey_enriched = pgView('vw_lead_journey_enriched', {
	journey_id: uuid('journey_id'),
	journey_created_at: timestamp('journey_created_at'),
	journey_updated_at: timestamp('journey_updated_at'),
	current_stage: text('current_stage'),
	outcome: text('outcome'),
	contact_email: text('contact_email'),
	contact_name: text('contact_name'),
	first_touch_type: text('first_touch_type'),
	first_touch_at: timestamp('first_touch_at'),
	journey_campaign_id: integer('journey_campaign_id'),
	journey_campaign_name: text('journey_campaign_name'),
	journey_page_id: integer('journey_page_id'),
	journey_page_slug: text('journey_page_slug'),
	first_visit_id: integer('first_visit_id'),
	first_campaign_id: integer('first_campaign_id'),
	first_campaign_name: text('first_campaign_name'),
	first_page_id: integer('first_page_id'),
	first_page_slug: text('first_page_slug'),
	first_utm_source: text('first_utm_source'),
	first_utm_medium: text('first_utm_medium'),
	first_utm_campaign: text('first_utm_campaign'),
	first_referrer: text('first_referrer'),
	first_cta_key: text('first_cta_key'),
	first_seen_at: timestamp('first_seen_at'),
	last_visit_id: integer('last_visit_id'),
	last_campaign_id: integer('last_campaign_id'),
	last_campaign_name: text('last_campaign_name'),
	last_page_id: integer('last_page_id'),
	last_page_slug: text('last_page_slug'),
	last_utm_source: text('last_utm_source'),
	last_utm_medium: text('last_utm_medium'),
	last_utm_campaign: text('last_utm_campaign'),
	last_referrer: text('last_referrer'),
	last_cta_key: text('last_cta_key'),
	last_seen_at: timestamp('last_seen_at'),
	attribution_model_version: text('attribution_model_version')
}).existing();

export const vw_lead_event_enriched = pgView('vw_lead_event_enriched', {
	lead_event_id: uuid('lead_event_id'),
	occurred_at: timestamp('occurred_at'),
	event_type: text('event_type'),
	event_source: text('event_source'),
	event_payload: jsonb('event_payload'),
	session_id: text('session_id'),
	anonymous_id: text('anonymous_id'),
	cta_key: text('cta_key'),
	cta_label: text('cta_label'),
	cta_section: text('cta_section'),
	cta_variant: text('cta_variant'),
	journey_id: uuid('journey_id'),
	event_campaign_id: integer('event_campaign_id'),
	event_campaign_name: text('event_campaign_name'),
	event_page_id: integer('event_page_id'),
	event_page_slug: text('event_page_slug'),
	journey_campaign_id: integer('journey_campaign_id'),
	journey_campaign_name: text('journey_campaign_name'),
	journey_page_id: integer('journey_page_id'),
	journey_page_slug: text('journey_page_slug'),
	resolved_campaign_id: integer('resolved_campaign_id'),
	resolved_campaign_name: text('resolved_campaign_name'),
	resolved_page_id: integer('resolved_page_id'),
	resolved_page_slug: text('resolved_page_slug'),
	journey_first_utm_source: text('journey_first_utm_source'),
	journey_first_utm_medium: text('journey_first_utm_medium'),
	journey_first_utm_campaign: text('journey_first_utm_campaign'),
	journey_last_utm_source: text('journey_last_utm_source'),
	journey_last_utm_medium: text('journey_last_utm_medium'),
	journey_last_utm_campaign: text('journey_last_utm_campaign'),
	journey_first_seen_at: timestamp('journey_first_seen_at'),
	journey_last_seen_at: timestamp('journey_last_seen_at'),
	journey_attribution_model_version: text('journey_attribution_model_version')
}).existing();

export const vw_booking_enriched = pgView('vw_booking_enriched', {
	booking_id: uuid('booking_id'),
	booking_type: booking_type('booking_type'),
	booking_status: booking_status('booking_status'),
	booking_created_at: timestamp('booking_created_at'),
	booking_updated_at: timestamp('booking_updated_at'),
	starts_at: timestamp('starts_at'),
	ends_at: timestamp('ends_at'),
	is_repeat_interaction: boolean('is_repeat_interaction'),
	email: text('email'),
	name: text('name'),
	company: text('company'),
	scope: text('scope'),
	journey_id: uuid('journey_id'),
	journey_current_stage: text('journey_current_stage'),
	journey_outcome: text('journey_outcome'),
	journey_campaign_id: integer('journey_campaign_id'),
	journey_campaign_name: text('journey_campaign_name'),
	journey_page_id: integer('journey_page_id'),
	journey_page_slug: text('journey_page_slug'),
	first_visit_id: integer('first_visit_id'),
	first_campaign_id: integer('first_campaign_id'),
	first_campaign_name: text('first_campaign_name'),
	first_page_id: integer('first_page_id'),
	first_page_slug: text('first_page_slug'),
	first_utm_source: text('first_utm_source'),
	first_utm_medium: text('first_utm_medium'),
	first_utm_campaign: text('first_utm_campaign'),
	first_referrer: text('first_referrer'),
	first_cta_key: text('first_cta_key'),
	first_seen_at: timestamp('first_seen_at'),
	last_visit_id: integer('last_visit_id'),
	last_campaign_id: integer('last_campaign_id'),
	last_campaign_name: text('last_campaign_name'),
	last_page_id: integer('last_page_id'),
	last_page_slug: text('last_page_slug'),
	last_utm_source: text('last_utm_source'),
	last_utm_medium: text('last_utm_medium'),
	last_utm_campaign: text('last_utm_campaign'),
	last_referrer: text('last_referrer'),
	last_cta_key: text('last_cta_key'),
	last_seen_at: timestamp('last_seen_at'),
	attribution_model_version: text('attribution_model_version'),
	first_touch_type: text('first_touch_type')
}).existing();

export const vw_funnel_daily = pgView('vw_funnel_daily', {
	report_date: timestamp('report_date'),
	visits: integer('visits'),
	unique_visitors: integer('unique_visitors'),
	journeys_created: integer('journeys_created'),
	identified_leads: integer('identified_leads'),
	inbound_messages: integer('inbound_messages'),
	booking_link_clicked: integer('booking_link_clicked'),
	bookings_completed: integer('bookings_completed'),
	visit_to_lead_rate: real('visit_to_lead_rate'),
	lead_to_booking_rate: real('lead_to_booking_rate'),
	visit_to_booking_rate: real('visit_to_booking_rate')
}).existing();

export const vw_direct_email_funnel_daily = pgView('vw_direct_email_funnel_daily', {
	report_date: timestamp('report_date'),
	visits: integer('visits'),
	direct_email_cta_clicks: integer('direct_email_cta_clicks'),
	alias_inbound_messages: integer('alias_inbound_messages'),
	direct_email_entries: integer('direct_email_entries'),
	email_first_touch_bookings: integer('email_first_touch_bookings'),
	visit_to_direct_email_rate: real('visit_to_direct_email_rate'),
	email_to_booking_rate: real('email_to_booking_rate')
}).existing();

export const vw_campaign_conversion_summary = pgView('vw_campaign_conversion_summary', {
	campaign_id: integer('campaign_id'),
	campaign_name: text('campaign_name'),
	visit_campaign_visits: integer('visit_campaign_visits'),
	journey_campaign_leads: integer('journey_campaign_leads'),
	first_touch_leads: integer('first_touch_leads'),
	first_touch_bookings: integer('first_touch_bookings'),
	visit_to_journey_lead_rate: real('visit_to_journey_lead_rate'),
	visit_to_first_touch_lead_rate: real('visit_to_first_touch_lead_rate'),
	first_touch_lead_to_booking_rate: real('first_touch_lead_to_booking_rate'),
	visit_to_first_touch_booking_rate: real('visit_to_first_touch_booking_rate')
}).existing();

export const vw_source_medium_performance = pgView('vw_source_medium_performance', {
	utm_source: text('utm_source'),
	utm_medium: text('utm_medium'),
	visit_touch_visits: integer('visit_touch_visits'),
	first_touch_leads: integer('first_touch_leads'),
	first_touch_bookings: integer('first_touch_bookings'),
	visit_to_first_touch_lead_rate: real('visit_to_first_touch_lead_rate'),
	first_touch_lead_to_booking_rate: real('first_touch_lead_to_booking_rate'),
	visit_to_first_touch_booking_rate: real('visit_to_first_touch_booking_rate')
}).existing();

export const vw_cta_performance = pgView('vw_cta_performance', {
	cta_key: text('cta_key'),
	cta_label: text('cta_label'),
	cta_section: text('cta_section'),
	cta_variant: text('cta_variant'),
	clicks: integer('clicks'),
	first_touch_leads: integer('first_touch_leads'),
	first_touch_bookings: integer('first_touch_bookings'),
	click_to_first_touch_lead_rate: real('click_to_first_touch_lead_rate'),
	click_to_first_touch_booking_rate: real('click_to_first_touch_booking_rate')
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
		first_visit_id: integer('first_visit_id').references(() => campaign_visits.id, {
			onDelete: 'set null'
		}),
		first_campaign_id: integer('first_campaign_id').references(() => campaigns.id, {
			onDelete: 'set null'
		}),
		first_page_id: integer('first_page_id').references(() => campaign_pages.id, {
			onDelete: 'set null'
		}),
		first_utm_source: text('first_utm_source'),
		first_utm_medium: text('first_utm_medium'),
		first_utm_campaign: text('first_utm_campaign'),
		first_referrer: text('first_referrer'),
		first_cta_key: text('first_cta_key'),
		first_seen_at: timestamp('first_seen_at'),
		last_visit_id: integer('last_visit_id').references(() => campaign_visits.id, {
			onDelete: 'set null'
		}),
		last_campaign_id: integer('last_campaign_id').references(() => campaigns.id, {
			onDelete: 'set null'
		}),
		last_page_id: integer('last_page_id').references(() => campaign_pages.id, {
			onDelete: 'set null'
		}),
		last_utm_source: text('last_utm_source'),
		last_utm_medium: text('last_utm_medium'),
		last_utm_campaign: text('last_utm_campaign'),
		last_referrer: text('last_referrer'),
		last_cta_key: text('last_cta_key'),
		last_seen_at: timestamp('last_seen_at'),
		attribution_model_version: text('attribution_model_version')
			.notNull()
			.default('journey_attribution_v1'),
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
		booking_link_invite_email_sent_at: timestamp('booking_link_invite_email_sent_at'),
		booking_link_invite_email_provider_message_id: text(
			'booking_link_invite_email_provider_message_id'
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
		cta_key: text('cta_key'),
		cta_label: text('cta_label'),
		cta_section: text('cta_section'),
		cta_variant: text('cta_variant'),
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
		status: booking_status('status').notNull().default('pending_calendar_sync'),
		starts_at: timestamp('starts_at').notNull(),
		ends_at: timestamp('ends_at').notNull(),
		google_calendar_event_id: text('google_calendar_event_id'),
		calendar_sync_error: text('calendar_sync_error'),
		booking_confirmation_email_sent_at: timestamp('booking_confirmation_email_sent_at'),
		booking_confirmation_email_provider_message_id: text(
			'booking_confirmation_email_provider_message_id'
		),
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

export const landing_page_asset_sets = pgTable(
	'landing_page_asset_sets',
	{
		id: serial('id').primaryKey(),
		asset_key: text('asset_key').notNull(),
		assets_json: jsonb('assets_json').notNull(),
		is_active: boolean('is_active').notNull().default(true),
		created_at: timestamp('created_at').notNull().defaultNow(),
		updated_at: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => ({
		assetKeyUniqueIdx: uniqueIndex('landing_page_asset_sets_asset_key_key').on(table.asset_key),
		activeSetIdx: uniqueIndex('landing_page_asset_sets_single_active_idx')
			.on(table.is_active)
			.where(sql`${table.is_active} = true`)
	})
);

// Keep the old task table for now (can be removed later)
export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

// Temporarily commented out until auth schema is generated
// export * from './auth.schema';
