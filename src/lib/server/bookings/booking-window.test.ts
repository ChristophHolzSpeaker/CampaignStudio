import { describe, expect, it } from 'vitest';
import { isSlotInsideBookingWindow } from './booking-window';

describe('isSlotInsideBookingWindow', () => {
	it('accepts slots within 07:00-21:00 in Europe/Berlin', () => {
		const result = isSlotInsideBookingWindow({
			startsAt: new Date('2026-05-01T18:30:00.000Z'),
			endsAt: new Date('2026-05-01T19:00:00.000Z'),
			timeZone: 'Europe/Berlin',
			windowStartMinutes: 7 * 60,
			windowEndMinutes: 21 * 60
		});

		expect(result).toBe(true);
	});

	it('rejects slots that start after 21:00 local time', () => {
		const result = isSlotInsideBookingWindow({
			startsAt: new Date('2026-05-01T19:00:00.000Z'),
			endsAt: new Date('2026-05-01T19:30:00.000Z'),
			timeZone: 'Europe/Berlin',
			windowStartMinutes: 7 * 60,
			windowEndMinutes: 21 * 60
		});

		expect(result).toBe(false);
	});
});
