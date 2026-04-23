import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./worker-calendar-client', () => ({
	createBookingCalendarEventViaWorker: vi.fn(),
	fetchBookingCalendarBusyViaWorker: vi.fn()
}));

import { fetchBookingCalendarBusyViaWorker } from './worker-calendar-client';
import {
	NoopCalendarAvailabilityProvider,
	WorkerCalendarAvailabilityProvider
} from './calendar-provider';

const mockedFetchBookingCalendarBusyViaWorker = vi.mocked(fetchBookingCalendarBusyViaWorker);

describe('NoopCalendarAvailabilityProvider', () => {
	beforeEach(() => {
		mockedFetchBookingCalendarBusyViaWorker.mockReset();
	});

	it('returns an empty interval set', async () => {
		const provider = new NoopCalendarAvailabilityProvider();

		const result = await provider.fetchBusyIntervals({
			rangeStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			rangeEndsAt: new Date('2026-05-01T12:00:00.000Z')
		});

		expect(result).toEqual({
			providerName: 'noop-calendar-provider',
			intervals: []
		});
	});
});

describe('WorkerCalendarAvailabilityProvider', () => {
	beforeEach(() => {
		mockedFetchBookingCalendarBusyViaWorker.mockReset();
	});

	it('maps worker busy response into booking intervals', async () => {
		mockedFetchBookingCalendarBusyViaWorker.mockResolvedValueOnce({
			ok: true,
			provider_name: 'google-calendar-freebusy',
			intervals: [
				{
					starts_at_iso: '2026-05-01T10:00:00.000Z',
					ends_at_iso: '2026-05-01T10:30:00.000Z',
					source: 'calendar'
				}
			]
		});

		const provider = new WorkerCalendarAvailabilityProvider();
		const result = await provider.fetchBusyIntervals({
			rangeStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			rangeEndsAt: new Date('2026-05-01T12:00:00.000Z'),
			calendarId: 'speaker@christophholz.com'
		});

		expect(mockedFetchBookingCalendarBusyViaWorker).toHaveBeenCalledWith({
			range_starts_at_iso: '2026-05-01T10:00:00.000Z',
			range_ends_at_iso: '2026-05-01T12:00:00.000Z',
			calendar_id: 'speaker@christophholz.com'
		});
		expect(result.providerName).toBe('google-calendar-freebusy');
		expect(result.intervals).toHaveLength(1);
		expect(result.intervals[0]?.startsAt.toISOString()).toBe('2026-05-01T10:00:00.000Z');
		expect(result.intervals[0]?.endsAt.toISOString()).toBe('2026-05-01T10:30:00.000Z');
		expect(result.intervals[0]?.source).toBe('calendar');
	});

	it('fails open and returns empty intervals when worker busy fetch fails', async () => {
		mockedFetchBookingCalendarBusyViaWorker.mockRejectedValueOnce(new Error('worker unavailable'));

		const provider = new WorkerCalendarAvailabilityProvider();
		const result = await provider.fetchBusyIntervals({
			rangeStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			rangeEndsAt: new Date('2026-05-01T12:00:00.000Z')
		});

		expect(result.providerName).toBe('worker-calendar-provider');
		expect(result.intervals).toEqual([]);
	});
});
