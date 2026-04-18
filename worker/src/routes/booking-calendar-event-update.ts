import { z } from 'zod';
import {
	bookingCalendarEventTypes,
	type UpdateBookingCalendarEventRequest
} from '../../../shared/booking-calendar';
import { badRequestFromZod, json } from '../lib/http';
import type { WorkerEnv } from '../lib/env';
import { updateCalendarEvent } from '../lib/calendar/client';

const bookingCalendarEventUpdateSchema = z.object({
	booking_id: z.string().uuid(),
	event_id: z.string().trim().min(1),
	booking_type: z.enum(bookingCalendarEventTypes),
	attendee_email: z.string().trim().email(),
	attendee_name: z.string().trim().max(120).nullable().optional(),
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

function buildSummary(input: UpdateBookingCalendarEventRequest): string {
	const kind = input.booking_type === 'lead' ? 'Lead call' : 'General briefing';
	const withName = input.attendee_name?.trim();
	if (!withName) {
		return `${kind} - ${input.attendee_email}`;
	}
	return `${kind} - ${withName}`;
}

function buildDescription(input: UpdateBookingCalendarEventRequest): string {
	const contextLines = [
		`Booking ID: ${input.booking_id}`,
		`Type: ${input.booking_type}`,
		`Attendee email: ${input.attendee_email}`,
		input.attendee_name ? `Attendee name: ${input.attendee_name}` : null,
		input.company ? `Company: ${input.company}` : null,
		`Repeat interaction: ${input.is_repeat_interaction ? 'yes' : 'no'}`,
		input.lead_context?.lead_journey_id
			? `Lead journey: ${input.lead_context.lead_journey_id}`
			: null,
		input.lead_context?.campaign_id ? `Campaign ID: ${input.lead_context.campaign_id}` : null,
		input.lead_context?.booking_link_id
			? `Booking link ID: ${input.lead_context.booking_link_id}`
			: null,
		'---',
		'Meeting scope:',
		input.meeting_scope,
		'---',
		`Reschedule link: ${input.reschedule_url}`
	].filter((line): line is string => Boolean(line));

	return contextLines.join('\n');
}

export async function handleBookingCalendarEventUpdate(
	request: Request,
	env: WorkerEnv
): Promise<Response> {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const parsed = bookingCalendarEventUpdateSchema.safeParse(payload);
	if (!parsed.success) {
		return badRequestFromZod(parsed.error);
	}

	const input = parsed.data;
	const startsAt = new Date(input.starts_at_iso);
	const endsAt = new Date(input.ends_at_iso);
	if (!(startsAt < endsAt)) {
		return json({ ok: false, error: 'starts_at_iso must be before ends_at_iso' }, 400);
	}

	const calendarEvent = await updateCalendarEvent(env, {
		calendarId: resolveCalendarId(env),
		eventId: input.event_id,
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
