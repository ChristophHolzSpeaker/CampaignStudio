import { z } from 'zod';
import {
	bookingCalendarEventTypes,
	type CreateBookingCalendarEventRequest
} from '../../../shared/booking-calendar';
import { json, badRequestFromZod } from '../lib/http';
import type { WorkerEnv } from '../lib/env';
import { createCalendarEvent } from '../lib/calendar/client';

const bookingCalendarEventSchema = z.object({
	booking_id: z.string().uuid(),
	booking_type: z.enum(bookingCalendarEventTypes),
	attendee_email: z.string().trim().email(),
	attendee_name: z.string().trim().max(120).nullable().optional(),
	attendee_phone: z
		.string()
		.trim()
		.regex(/^\+?\d{8,15}$/)
		.nullable()
		.optional(),
	meeting_scope: z.string().trim().min(2).max(1000),
	starts_at_iso: z.string().datetime({ offset: true }),
	ends_at_iso: z.string().datetime({ offset: true }),
	reschedule_url: z.string().trim().url(),
	company: z.string().trim().max(120).nullable().optional(),
	is_repeat_interaction: z.boolean(),
	lead_context: z
		.object({
			lead_journey_id: z.string().uuid().nullable().optional(),
			campaign_id: z.number().int().positive().nullable().optional(),
			booking_link_id: z.string().uuid().nullable().optional()
		})
		.nullable()
		.optional()
});

function resolveCalendarId(env: WorkerEnv): string {
	return (
		env.BOOKING_CALENDAR_ID?.trim() ||
		env.GOOGLE_IMPERSONATED_USER?.trim() ||
		'speaker@christophholz.com'
	);
}

function buildSummary(input: CreateBookingCalendarEventRequest): string {
	const attendee = input.attendee_name?.trim() || input.attendee_email;
	const company = input.company?.trim();
	if (!company) {
		return `Video briefing with Christoph + ${attendee}`;
	}

	return `Video briefing with Christoph + ${attendee} from ${company}`;
}

function buildDescription(input: CreateBookingCalendarEventRequest): string {
	const contextLines = [
		'Request summary:',
		input.meeting_scope,
		'',
		'Video call link:',
		'https://zoom.christophholz.com',
		'',
		`Reschedule link: ${input.reschedule_url}`
	];

	return contextLines.join('\n');
}

export async function handleBookingCalendarEvent(
	request: Request,
	env: WorkerEnv
): Promise<Response> {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const parsed = bookingCalendarEventSchema.safeParse(payload);
	if (!parsed.success) {
		return badRequestFromZod(parsed.error);
	}

	const input = parsed.data;
	const startsAt = new Date(input.starts_at_iso);
	const endsAt = new Date(input.ends_at_iso);
	if (!(startsAt < endsAt)) {
		return json({ ok: false, error: 'starts_at_iso must be before ends_at_iso' }, 400);
	}

	const calendarEvent = await createCalendarEvent(env, {
		calendarId: resolveCalendarId(env),
		summary: buildSummary(input),
		description: buildDescription(input),
		startsAtIso: input.starts_at_iso,
		endsAtIso: input.ends_at_iso,
		attendees: [
			{
				email: input.attendee_email,
				displayName: input.attendee_name ?? undefined
			}
		]
	});

	return json({
		ok: true,
		event_id: calendarEvent.id,
		html_link: calendarEvent.htmlLink
	});
}
