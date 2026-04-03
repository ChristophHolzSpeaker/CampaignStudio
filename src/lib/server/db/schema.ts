import { pgTable, serial, integer, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const campaigns = pgTable('campaigns', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	audience: text('audience').notNull(),
	format: text('format').notNull(),
	topic: text('topic').notNull(),
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

export const prompts = pgTable('prompts', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	purpose: text('purpose').notNull(),
	audience: text('audience').notNull(),
	format: text('format').notNull(),
	topic: text('topic'),
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
