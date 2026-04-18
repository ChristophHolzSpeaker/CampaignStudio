import { z } from 'zod';
import { badRequestFromZod, json } from '../lib/http';
import type { WorkerEnv } from '../lib/env';
import { sendTelegramNotification } from '../lib/telegram/service';
import type { TelegramNotificationRequest } from '../../../shared/telegram-notifications';

const bookingTypeSchema = z.enum(['lead', 'general']);

const campaignContextSchema = z
	.object({
		lead_journey_id: z.string().uuid().nullable().optional(),
		campaign_id: z.number().int().positive().nullable().optional(),
		campaign_page_id: z.number().int().positive().nullable().optional(),
		booking_link_id: z.string().uuid().nullable().optional(),
		page_slug: z.string().trim().min(1).max(255).nullable().optional(),
		page_path: z.string().trim().min(1).max(512).nullable().optional()
	})
	.nullable()
	.optional();

const urlsSchema = z
	.object({
		reschedule_url: z.string().trim().url().nullable().optional(),
		calendar_event_url: z.string().trim().url().nullable().optional(),
		booking_url: z.string().trim().url().nullable().optional(),
		campaign_page_url: z.string().trim().url().nullable().optional()
	})
	.nullable()
	.optional();

const attendeeSchema = z.object({
	attendee_name: z.string().trim().max(120).nullable().optional(),
	attendee_email: z.string().trim().email().nullable().optional(),
	company: z.string().trim().max(120).nullable().optional()
});

const timeRangeSchema = z.object({
	starts_at_iso: z.string().datetime({ offset: true }),
	ends_at_iso: z.string().datetime({ offset: true })
});

const metadataSchema = z.record(z.string(), z.unknown()).optional();

const newLeadNotificationSchema = z.object({
	type: z.literal('new_lead'),
	lead_journey_id: z.string().uuid().nullable().optional(),
	meeting_scope: z.string().trim().min(2).max(1000).nullable().optional(),
	campaign_context: campaignContextSchema,
	urls: urlsSchema,
	metadata: metadataSchema,
	...attendeeSchema.shape
});

const bookingConfirmedNotificationSchema = z.object({
	type: z.literal('booking_confirmed'),
	booking_id: z.string().uuid(),
	booking_type: bookingTypeSchema,
	meeting_scope: z.string().trim().min(2).max(1000).nullable().optional(),
	booking_time: timeRangeSchema,
	campaign_context: campaignContextSchema,
	urls: urlsSchema,
	metadata: metadataSchema,
	...attendeeSchema.shape
});

const bookingRescheduledNotificationSchema = z.object({
	type: z.literal('booking_rescheduled'),
	booking_id: z.string().uuid(),
	booking_type: bookingTypeSchema,
	meeting_scope: z.string().trim().min(2).max(1000).nullable().optional(),
	previous_booking_time: timeRangeSchema,
	new_booking_time: timeRangeSchema,
	campaign_context: campaignContextSchema,
	urls: urlsSchema,
	metadata: metadataSchema,
	...attendeeSchema.shape
});

const telegramNotificationSchema = z.discriminatedUnion('type', [
	newLeadNotificationSchema,
	bookingConfirmedNotificationSchema,
	bookingRescheduledNotificationSchema
]);

export async function handleTelegramNotification(
	request: Request,
	env: WorkerEnv
): Promise<Response> {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const parsed = telegramNotificationSchema.safeParse(payload);
	if (!parsed.success) {
		return badRequestFromZod(parsed.error);
	}
	const input: TelegramNotificationRequest = parsed.data;

	try {
		const result = await sendTelegramNotification(env, input);
		return json({ ok: true, message_id: result.message_id });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Telegram send failed';
		return json({ ok: false, error: message }, 502);
	}
}
