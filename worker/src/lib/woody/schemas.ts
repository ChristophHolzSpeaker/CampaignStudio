import { z } from 'zod';
import { woodyResponseTypes } from './types';

const toDetermine = 'To Determine';

function normalizeExtractedValue(value: string): string {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : toDetermine;
}

export const woodyGenerateReplyInputSchema = z.object({
	sender_name: z.string().trim().min(1).max(160).nullable().optional(),
	sender_email: z.string().trim().email(),
	inbound_subject: z.string().trim().min(1).max(500),
	inbound_body: z.string().trim().min(1),
	response_language: z.string().trim().min(2).max(80),
	booking_link: z.string().trim().url(),
	response_type: z.enum(woodyResponseTypes),
	campaign_id: z.number().int().positive().nullable().optional(),
	campaign_page_id: z.number().int().positive().nullable().optional(),
	lead_journey_id: z.string().uuid().nullable().optional()
});

export const woodyExtractedFieldsSchema = z.object({
	event_topic: z.string().transform(normalizeExtractedValue),
	talking_length: z.string().transform(normalizeExtractedValue),
	location: z.string().transform(normalizeExtractedValue),
	date_time: z.string().transform(normalizeExtractedValue),
	event_name: z.string().transform(normalizeExtractedValue),
	audience: z.string().transform(normalizeExtractedValue),
	agent: z.string().transform(normalizeExtractedValue),
	client: z.string().transform(normalizeExtractedValue)
});

export const woodyModelOutputSchema = z.object({
	subject: z.string().trim().min(1).max(300),
	body_html: z.string().trim().min(1),
	body_text: z.string().trim().min(1),
	extracted_fields: woodyExtractedFieldsSchema
});

export const woodyGenerateReplyOutputSchema = z.object({
	subject: z.string(),
	body_html: z.string(),
	body_text: z.string(),
	extracted_fields: woodyExtractedFieldsSchema,
	model: z.string().min(1),
	provider: z.literal('openrouter'),
	prompt_version: z.string().min(1),
	generation_status: z.enum(['success', 'error']),
	raw_usage: z.unknown().nullable(),
	raw_response: z.unknown().nullable()
});

export type WoodyGenerateReplyInputParsed = z.infer<typeof woodyGenerateReplyInputSchema>;
export type WoodyModelOutputParsed = z.infer<typeof woodyModelOutputSchema>;
export type WoodyGenerateReplyOutputParsed = z.infer<typeof woodyGenerateReplyOutputSchema>;

export const WOODY_TO_DETERMINE = toDetermine;
