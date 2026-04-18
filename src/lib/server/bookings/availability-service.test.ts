import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingCalendarAvailabilityProvider } from './calendar-provider';

vi.mock('./policy', () => ({
	getBookingPolicy: vi.fn()
}));

import { getBookingPolicy } from './policy';
import { getBookingAvailability } from './availability-service';

const mockedGetBookingPolicy = vi.mocked(getBookingPolicy);

describe('getBookingAvailability', () => {
	beforeEach(() => {
		mockedGetBookingPolicy.mockReset();
	});

	it('does not call calendar provider when policy is not active', async () => {
		mockedGetBookingPolicy.mockResolvedValueOnce({
			state: 'globally_paused',
			bookingType: 'lead',
			pause: {
				isPaused: true,
				pauseMessage: 'Paused',
				settingsRowId: 'settings_1',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			},
			rules: null
		});

		const provider: BookingCalendarAvailabilityProvider = {
			fetchBusyIntervals: vi.fn()
		};

		const result = await getBookingAvailability({
			bookingType: 'lead',
			searchStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			searchEndsAt: new Date('2026-05-01T12:00:00.000Z'),
			calendarProvider: provider
		});

		expect(provider.fetchBusyIntervals).not.toHaveBeenCalled();
		expect(result.state).toBe('bookings_paused');
	});

	it('calls provider and computes slots for active policy', async () => {
		mockedGetBookingPolicy.mockResolvedValueOnce({
			state: 'active',
			bookingType: 'general',
			pause: {
				isPaused: false,
				pauseMessage: null,
				settingsRowId: null,
				updatedAt: null
			},
			rules: {
				bookingType: 'general',
				advanceNoticeMinutes: 0,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule_1',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			}
		});

		const fetchBusyIntervals = vi.fn().mockResolvedValue({
			providerName: 'test-provider',
			intervals: [
				{
					startsAt: new Date('2026-05-01T10:00:00.000Z'),
					endsAt: new Date('2026-05-01T10:30:00.000Z'),
					source: 'calendar' as const
				}
			]
		});

		const provider: BookingCalendarAvailabilityProvider = {
			fetchBusyIntervals
		};

		const result = await getBookingAvailability({
			bookingType: 'general',
			searchStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			searchEndsAt: new Date('2026-05-01T11:00:00.000Z'),
			calendarProvider: provider,
			calendarId: 'speaker@calendar.test'
		});

		expect(fetchBusyIntervals).toHaveBeenCalledOnce();
		expect(fetchBusyIntervals).toHaveBeenCalledWith({
			rangeStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			rangeEndsAt: new Date('2026-05-01T11:00:00.000Z'),
			calendarId: 'speaker@calendar.test'
		});
		expect(result.state).toBe('available');
		expect(result.slots).toHaveLength(1);
		expect(result.slots[0]?.startsAt.toISOString()).toBe('2026-05-01T10:30:00.000Z');
	});

	it('ignores configured busy interval while computing slots', async () => {
		mockedGetBookingPolicy.mockResolvedValueOnce({
			state: 'active',
			bookingType: 'general',
			pause: {
				isPaused: false,
				pauseMessage: null,
				settingsRowId: null,
				updatedAt: null
			},
			rules: {
				bookingType: 'general',
				advanceNoticeMinutes: 0,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule_2',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			}
		});

		const blockedInterval = {
			startsAt: new Date('2026-05-01T10:00:00.000Z'),
			endsAt: new Date('2026-05-01T10:30:00.000Z')
		};

		const provider: BookingCalendarAvailabilityProvider = {
			fetchBusyIntervals: vi.fn().mockResolvedValue({
				providerName: 'test-provider',
				intervals: [{ ...blockedInterval, source: 'calendar' as const }]
			})
		};

		const result = await getBookingAvailability({
			bookingType: 'general',
			searchStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			searchEndsAt: new Date('2026-05-01T11:00:00.000Z'),
			calendarProvider: provider,
			ignoredBusyIntervals: [blockedInterval]
		});

		expect(result.state).toBe('available');
		expect(result.slots).toHaveLength(2);
		expect(result.slots[0]?.startsAt.toISOString()).toBe('2026-05-01T10:00:00.000Z');
	});

	it('uses updated rule duration and interval values when evaluating availability', async () => {
		mockedGetBookingPolicy.mockResolvedValueOnce({
			state: 'active',
			bookingType: 'lead',
			pause: {
				isPaused: false,
				pauseMessage: null,
				settingsRowId: null,
				updatedAt: null
			},
			rules: {
				bookingType: 'lead',
				advanceNoticeMinutes: 0,
				slotDurationMinutes: 45,
				slotIntervalMinutes: 15,
				isEnabled: true,
				ruleRowId: 'rule-updated',
				updatedAt: new Date('2026-04-20T00:00:00.000Z')
			}
		});

		const provider: BookingCalendarAvailabilityProvider = {
			fetchBusyIntervals: vi.fn().mockResolvedValue({
				providerName: 'test-provider',
				intervals: []
			})
		};

		const result = await getBookingAvailability({
			bookingType: 'lead',
			searchStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			searchEndsAt: new Date('2026-05-01T11:00:00.000Z'),
			calendarProvider: provider
		});

		expect(result.state).toBe('available');
		expect(result.slots).toHaveLength(2);
		expect(result.slots[0]?.startsAt.toISOString()).toBe('2026-05-01T10:00:00.000Z');
		expect(result.slots[0]?.endsAt.toISOString()).toBe('2026-05-01T10:45:00.000Z');
		expect(result.slots[1]?.startsAt.toISOString()).toBe('2026-05-01T10:15:00.000Z');
		expect(result.slots[1]?.endsAt.toISOString()).toBe('2026-05-01T11:00:00.000Z');
	});
});
