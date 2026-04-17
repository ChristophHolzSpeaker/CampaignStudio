import { describe, expect, it } from 'vitest';
import { NoopCalendarAvailabilityProvider } from './calendar-provider';

describe('NoopCalendarAvailabilityProvider', () => {
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
