import { z } from 'zod';
import type { FetchBookingCalendarBusyRequest } from '../../../shared/booking-calendar';
import { badRequestFromZod, json } from '../lib/http';
import type { WorkerEnv } from '../lib/env';
import { fetchCalendarBusyIntervals } from '../lib/calendar/client';

const bookingCalendarBusySchema = z.object({
	range_starts_at_iso: z.string().datetime({ offset: true }),
	range_ends_at_iso: z.string().datetime({ offset: true }),
	calendar_id: z.string().trim().min(1).optional()
});

function resolveCalendarId(env: WorkerEnv, requestedCalendarId: string | undefined): string {
	const requested = requestedCalendarId?.trim();
	if (requested) {
		return requested;
	}

	return (
		env.BOOKING_CALENDAR_ID?.trim() ||
		env.GOOGLE_IMPERSONATED_USER?.trim() ||
		'speaker@christophholz.com'
	);
}

export async function handleBookingCalendarBusy(
	request: Request,
	env: WorkerEnv
): Promise<Response> {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const parsed = bookingCalendarBusySchema.safeParse(payload);
	if (!parsed.success) {
		return badRequestFromZod(parsed.error);
	}

	const input = parsed.data satisfies FetchBookingCalendarBusyRequest;
	const startsAt = new Date(input.range_starts_at_iso);
	const endsAt = new Date(input.range_ends_at_iso);

	if (!(startsAt < endsAt)) {
		return json({ ok: false, error: 'range_starts_at_iso must be before range_ends_at_iso' }, 400);
	}

	const calendarId = resolveCalendarId(env, input.calendar_id);
	const intervals = await fetchCalendarBusyIntervals(env, {
		calendarId,
		rangeStartsAtIso: startsAt.toISOString(),
		rangeEndsAtIso: endsAt.toISOString()
	});

	return json({
		ok: true,
		provider_name: 'google-calendar-freebusy',
		intervals: intervals.map((interval) => ({
			starts_at_iso: interval.startsAtIso,
			ends_at_iso: interval.endsAtIso,
			source: 'calendar' as const
		}))
	});
}
