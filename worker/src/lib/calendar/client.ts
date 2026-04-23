import { getCalendarAccessToken } from '../google-auth/token';
import type { WorkerEnv } from '../env';

const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export type CalendarEventAttendee = {
	email: string;
	displayName?: string;
};

export type CalendarCreateEventInput = {
	calendarId: string;
	summary: string;
	description: string;
	startsAtIso: string;
	endsAtIso: string;
	attendees: CalendarEventAttendee[];
};

export type CalendarCreateEventResult = {
	id: string;
	htmlLink?: string;
};

export type CalendarUpdateEventInput = {
	calendarId: string;
	eventId: string;
	summary: string;
	description: string;
	startsAtIso: string;
	endsAtIso: string;
	attendees: CalendarEventAttendee[];
};

export type CalendarUpdateEventResult = {
	id: string;
	htmlLink?: string;
};

export type CalendarFetchBusyInput = {
	calendarId: string;
	rangeStartsAtIso: string;
	rangeEndsAtIso: string;
};

export type CalendarFetchBusyInterval = {
	startsAtIso: string;
	endsAtIso: string;
};

type GoogleCalendarFreeBusyResponse = {
	calendars?: Record<
		string,
		{
			busy?: Array<{
				start?: string;
				end?: string;
			}>;
		}
	>;
};

type GoogleCalendarEventResponse = {
	id?: string;
	htmlLink?: string;
};

async function calendarRequest<T>(
	env: WorkerEnv,
	input: {
		method: 'POST' | 'PATCH';
		path: string;
		body: unknown;
	}
): Promise<T> {
	const accessToken = await getCalendarAccessToken(env);
	const url = new URL(`${GOOGLE_CALENDAR_API_BASE}${input.path}`);

	const response = await fetch(url.toString(), {
		method: input.method,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(input.body)
	});

	if (!response.ok) {
		throw new Error(`Calendar API request failed (${response.status})`);
	}

	return (await response.json()) as T;
}

export async function createCalendarEvent(
	env: WorkerEnv,
	input: CalendarCreateEventInput
): Promise<CalendarCreateEventResult> {
	const response = await calendarRequest<GoogleCalendarEventResponse>(env, {
		method: 'POST',
		path: `/calendars/${encodeURIComponent(input.calendarId)}/events`,
		body: {
			summary: input.summary,
			description: input.description,
			start: {
				dateTime: input.startsAtIso
			},
			end: {
				dateTime: input.endsAtIso
			},
			attendees: input.attendees
		}
	});

	if (!response.id) {
		throw new Error('Calendar API response missing event id');
	}

	return {
		id: response.id,
		htmlLink: response.htmlLink
	};
}

export async function updateCalendarEvent(
	env: WorkerEnv,
	input: CalendarUpdateEventInput
): Promise<CalendarUpdateEventResult> {
	const response = await calendarRequest<GoogleCalendarEventResponse>(env, {
		method: 'PATCH',
		path: `/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
		body: {
			summary: input.summary,
			description: input.description,
			start: {
				dateTime: input.startsAtIso
			},
			end: {
				dateTime: input.endsAtIso
			},
			attendees: input.attendees
		}
	});

	if (!response.id) {
		throw new Error('Calendar API response missing event id');
	}

	return {
		id: response.id,
		htmlLink: response.htmlLink
	};
}

export async function fetchCalendarBusyIntervals(
	env: WorkerEnv,
	input: CalendarFetchBusyInput
): Promise<CalendarFetchBusyInterval[]> {
	const response = await calendarRequest<GoogleCalendarFreeBusyResponse>(env, {
		method: 'POST',
		path: '/freeBusy',
		body: {
			timeMin: input.rangeStartsAtIso,
			timeMax: input.rangeEndsAtIso,
			items: [{ id: input.calendarId }]
		}
	});

	const busyEntries = response.calendars?.[input.calendarId]?.busy ?? [];
	const intervals: CalendarFetchBusyInterval[] = [];

	for (const entry of busyEntries) {
		if (!entry.start || !entry.end) {
			continue;
		}

		const startsAt = new Date(entry.start);
		const endsAt = new Date(entry.end);

		if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
			continue;
		}

		if (startsAt >= endsAt) {
			continue;
		}

		intervals.push({
			startsAtIso: startsAt.toISOString(),
			endsAtIso: endsAt.toISOString()
		});
	}

	return intervals;
}
