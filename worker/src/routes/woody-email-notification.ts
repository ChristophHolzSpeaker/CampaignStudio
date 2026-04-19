import { z } from 'zod';
import type { WorkerEnv } from '../lib/env';
import { requireEnv } from '../lib/env';
import { badRequestFromZod, json } from '../lib/http';
import type {
	WoodyEmailNotificationRequest,
	WoodyEmailNotificationResponse
} from '../../../shared/woody-email-notifications';
import { sendOutboundEmail } from '../lib/gmail/send';

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

const summaryContextSchema = z
	.object({
		meeting_scope: z.string().trim().min(2).max(1000).nullable().optional(),
		request_summary: z.string().trim().min(2).max(2000).nullable().optional(),
		organization: z.string().trim().min(1).max(120).nullable().optional(),
		booking_mode: bookingTypeSchema.nullable().optional()
	})
	.nullable()
	.optional();

const emailContentSchema = z.object({
	subject: z.string().trim().min(1).max(255),
	body_text: z.string().trim().min(1).max(20000),
	body_html: z.string().trim().min(1).max(50000).optional()
});

const metadataSchema = z.record(z.string(), z.unknown()).optional();

const bookingLinkInviteSchema = z.object({
	intent: z.literal('booking_link_invite'),
	recipient_email: z.string().trim().email(),
	recipient_name: z.string().trim().max(120).nullable().optional(),
	booking_type: z.literal('lead'),
	booking_link_url: z.string().trim().url(),
	campaign_context: campaignContextSchema,
	summary_context: summaryContextSchema,
	email_content: emailContentSchema,
	metadata: metadataSchema
});

const bookingConfirmedSchema = z.object({
	intent: z.literal('booking_confirmed'),
	recipient_email: z.string().trim().email(),
	recipient_name: z.string().trim().max(120).nullable().optional(),
	booking_id: z.string().uuid(),
	booking_type: bookingTypeSchema,
	confirmed_starts_at_iso: z.string().datetime({ offset: true }),
	confirmed_ends_at_iso: z.string().datetime({ offset: true }),
	calendar_event_url: z.string().trim().url(),
	campaign_context: campaignContextSchema,
	summary_context: summaryContextSchema,
	email_content: emailContentSchema,
	metadata: metadataSchema
});

const woodyEmailNotificationSchema = z.discriminatedUnion('intent', [
	bookingLinkInviteSchema,
	bookingConfirmedSchema
]);

function toRawMetadata(input: WoodyEmailNotificationRequest): Record<string, unknown> {
	return {
		woody_email: {
			intent: input.intent,
			campaign_context: input.campaign_context ?? null,
			summary_context: input.summary_context ?? null,
			booking_link_url: input.intent === 'booking_link_invite' ? input.booking_link_url : null,
			booking_id: input.intent === 'booking_confirmed' ? input.booking_id : null,
			booking_type: input.intent === 'booking_confirmed' ? input.booking_type : input.booking_type,
			confirmed_starts_at_iso:
				input.intent === 'booking_confirmed' ? input.confirmed_starts_at_iso : null,
			confirmed_ends_at_iso:
				input.intent === 'booking_confirmed' ? input.confirmed_ends_at_iso : null,
			calendar_event_url: input.intent === 'booking_confirmed' ? input.calendar_event_url : null,
			metadata: input.metadata ?? null
		}
	};
}

export async function handleWoodyEmailNotification(
	request: Request,
	env: WorkerEnv
): Promise<Response> {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const parsed = woodyEmailNotificationSchema.safeParse(payload);
	if (!parsed.success) {
		return badRequestFromZod(parsed.error);
	}

	const input: WoodyEmailNotificationRequest = parsed.data;

	try {
		const result = await sendOutboundEmail(env, {
			leadJourneyId: input.campaign_context?.lead_journey_id ?? null,
			gmailUser: requireEnv(env, 'GOOGLE_IMPERSONATED_USER'),
			to: [input.recipient_email],
			subject: input.email_content.subject,
			bodyText: input.email_content.body_text,
			bodyHtml: input.email_content.body_html,
			autoResponseDecision: null,
			campaignId: input.campaign_context?.campaign_id ?? null,
			campaignPageId: input.campaign_context?.campaign_page_id ?? null,
			rawMetadata: toRawMetadata(input)
		});

		const response: WoodyEmailNotificationResponse = {
			ok: true,
			provider_message_id: result.provider_message_id,
			provider_thread_id: result.provider_thread_id,
			lead_message_id: result.lead_message_id
		};

		return json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Woody email send failed';
		return json({ ok: false, error: message }, 502);
	}
}
