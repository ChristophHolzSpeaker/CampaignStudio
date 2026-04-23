import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/calendar/client', () => ({
	fetchCalendarBusyIntervals: vi.fn()
}));

import { fetchCalendarBusyIntervals } from '../lib/calendar/client';
import { handleBookingCalendarBusy } from './booking-calendar-busy';
import { makeTestEnv } from '../test/helpers';

const mockedFetchCalendarBusyIntervals = vi.mocked(fetchCalendarBusyIntervals);

describe('handleBookingCalendarBusy', () => {
	beforeEach(() => {
		mockedFetchCalendarBusyIntervals.mockReset();
	});

	it('returns validation error when payload is invalid', async () => {
		const response = await handleBookingCalendarBusy(
			new Request('https://worker.test/booking/calendar-busy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ range_starts_at_iso: '2026-06-01T10:00:00.000Z' })
			}),
			makeTestEnv()
		);

		expect(response.status).toBe(400);
		expect(mockedFetchCalendarBusyIntervals).not.toHaveBeenCalled();
	});

	it('returns bad request when range start is after end', async () => {
		const response = await handleBookingCalendarBusy(
			new Request('https://worker.test/booking/calendar-busy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					range_starts_at_iso: '2026-06-01T12:00:00.000Z',
					range_ends_at_iso: '2026-06-01T10:00:00.000Z'
				})
			}),
			makeTestEnv()
		);

		expect(response.status).toBe(400);
		expect(mockedFetchCalendarBusyIntervals).not.toHaveBeenCalled();
	});

	it('returns normalized busy intervals from calendar client', async () => {
		mockedFetchCalendarBusyIntervals.mockResolvedValueOnce([
			{
				startsAtIso: '2026-06-01T10:00:00.000Z',
				endsAtIso: '2026-06-01T10:30:00.000Z'
			}
		]);

		const response = await handleBookingCalendarBusy(
			new Request('https://worker.test/booking/calendar-busy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					range_starts_at_iso: '2026-06-01T10:00:00.000Z',
					range_ends_at_iso: '2026-06-01T12:00:00.000Z'
				})
			}),
			makeTestEnv({ BOOKING_CALENDAR_ID: 'speaker@christophholz.com' })
		);

		expect(response.status).toBe(200);
		expect(mockedFetchCalendarBusyIntervals).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({
				calendarId: 'speaker@christophholz.com',
				rangeStartsAtIso: '2026-06-01T10:00:00.000Z',
				rangeEndsAtIso: '2026-06-01T12:00:00.000Z'
			})
		);

		const payload = (await response.json()) as {
			ok: boolean;
			provider_name: string;
			intervals: Array<{ starts_at_iso: string; ends_at_iso: string; source: string }>;
		};

		expect(payload.ok).toBe(true);
		expect(payload.provider_name).toBe('google-calendar-freebusy');
		expect(payload.intervals).toEqual([
			{
				starts_at_iso: '2026-06-01T10:00:00.000Z',
				ends_at_iso: '2026-06-01T10:30:00.000Z',
				source: 'calendar'
			}
		]);
	});
});
