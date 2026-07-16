import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./requester-classification', () => ({
	classifyBookingRequesterByEmail: vi.fn()
}));

vi.mock('./availability-service', () => ({
	getBookingAvailability: vi.fn()
}));

import { getBookingAvailability } from './availability-service';
import { classifyBookingRequesterByEmail } from './requester-classification';
import {
	getPublicBookingUnavailableMessage,
	getPublicBookingSearchWindow,
	resolvePublicBookingSlots,
	PUBLIC_BOOKING_LEAD_WORKING_DAYS,
	PUBLIC_BOOKING_SLOT_WINDOW_DAYS
} from './public-flow';

const mockedGetBookingAvailability = vi.mocked(getBookingAvailability);
const mockedClassifyBookingRequesterByEmail = vi.mocked(classifyBookingRequesterByEmail);

describe('public booking flow service', () => {
	beforeEach(() => {
		mockedGetBookingAvailability.mockReset();
		mockedClassifyBookingRequesterByEmail.mockReset();
	});

	it('creates a default 3-day search window for general bookings', () => {
		const now = new Date('2026-05-01T10:00:00.000Z');
		const result = getPublicBookingSearchWindow({ now, bookingType: 'general' });

		expect(result.searchStartsAt.toISOString()).toBe('2026-05-01T10:00:00.000Z');
		expect(result.searchEndsAt.toISOString()).toBe('2026-05-04T10:00:00.000Z');
		expect(PUBLIC_BOOKING_SLOT_WINDOW_DAYS).toBe(3);
	});

	it('creates an inclusive D+2 through D+14 calendar window in the configured timezone', () => {
		const result = getPublicBookingSearchWindow({
			now: new Date('2026-03-27T12:00:00.000Z'),
			bookingType: 'general',
			slotProfile: {
				earliestDayOffset: 2,
				latestDayOffset: 14,
				maxSlotsPerDayPeriod: 2,
				timeZone: 'Europe/Berlin'
			}
		});

		expect(result.searchStartsAt.toISOString()).toBe('2026-03-28T23:00:00.000Z');
		expect(result.searchEndsAt.toISOString()).toBe('2026-04-10T22:00:00.000Z');
	});

	it('creates a lead window including today plus 3 working days when starting on Monday', () => {
		const now = new Date('2026-05-04T10:00:00.000Z');
		const result = getPublicBookingSearchWindow({ now, bookingType: 'lead' });

		expect(result.searchStartsAt.toISOString()).toBe('2026-05-04T10:00:00.000Z');
		expect(result.searchEndsAt.toISOString()).toBe('2026-05-07T10:00:00.000Z');
		expect(PUBLIC_BOOKING_LEAD_WORKING_DAYS).toBe(3);
	});

	it('creates a lead window that bridges weekend when starting on Friday', () => {
		const now = new Date('2026-05-01T10:00:00.000Z');
		const result = getPublicBookingSearchWindow({ now, bookingType: 'lead' });

		expect(result.searchStartsAt.toISOString()).toBe('2026-05-01T10:00:00.000Z');
		expect(result.searchEndsAt.toISOString()).toBe('2026-05-06T10:00:00.000Z');
	});

	it('resolves classification and groups slot presentation by day', async () => {
		mockedClassifyBookingRequesterByEmail.mockResolvedValueOnce({
			email: 'person@example.com',
			normalizedEmail: 'person@example.com',
			hasPriorBookings: false,
			hasUpcomingBooking: false,
			interactionKind: 'first_time',
			upcomingBooking: null,
			recentBooking: null,
			totalBookings: 0
		});

		mockedGetBookingAvailability.mockResolvedValueOnce({
			state: 'available',
			policy: {
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
					ruleRowId: 'rule-general',
					updatedAt: new Date('2026-04-17T00:00:00.000Z')
				}
			},
			slots: [
				{
					startsAt: new Date('2026-05-02T10:00:00.000Z'),
					endsAt: new Date('2026-05-02T10:30:00.000Z'),
					bookingType: 'general',
					source: 'computed'
				},
				{
					startsAt: new Date('2026-05-02T11:00:00.000Z'),
					endsAt: new Date('2026-05-02T11:30:00.000Z'),
					bookingType: 'general',
					source: 'computed'
				},
				{
					startsAt: new Date('2026-05-03T09:00:00.000Z'),
					endsAt: new Date('2026-05-03T09:30:00.000Z'),
					bookingType: 'general',
					source: 'computed'
				}
			],
			searchStartsAt: new Date('2026-05-01T00:00:00.000Z'),
			searchEndsAt: new Date('2026-05-04T00:00:00.000Z')
		});

		const result = await resolvePublicBookingSlots({
			bookingType: 'general',
			requesterEmail: 'person@example.com',
			now: new Date('2026-05-01T00:00:00.000Z')
		});

		expect(result.classification.interactionKind).toBe('first_time');
		expect(result.availability.state).toBe('available');
		expect(result.slotGroups).toHaveLength(2);
		expect(result.slotGroups[0]?.dateKey).toBe('2026-05-02');
		expect(result.slotGroups[0]?.slots).toHaveLength(2);
		expect(result.slotGroups[1]?.dateKey).toBe('2026-05-03');
	});

	it('limits special presentation to two slots per day period without the global 40-slot cap', async () => {
		mockedClassifyBookingRequesterByEmail.mockResolvedValueOnce({
			email: 'person@example.com',
			normalizedEmail: 'person@example.com',
			hasPriorBookings: false,
			hasUpcomingBooking: false,
			interactionKind: 'first_time',
			upcomingBooking: null,
			recentBooking: null,
			totalBookings: 0
		});

		const slots = Array.from({ length: 13 }, (_, dayOffset) => {
			const hours = dayOffset === 0 ? [6, 7, 8, 10, 11, 12, 15, 16, 17] : [6, 7, 10, 11, 15, 16];

			return hours.map((hour) => {
				const startsAt = new Date(Date.UTC(2026, 4, 2 + dayOffset, hour));

				return {
					startsAt,
					endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
					bookingType: 'general' as const,
					source: 'computed' as const
				};
			});
		}).flat();

		mockedGetBookingAvailability.mockResolvedValueOnce({
			state: 'available',
			policy: {
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
					ruleRowId: 'rule-general',
					updatedAt: new Date('2026-04-17T00:00:00.000Z')
				}
			},
			slots,
			searchStartsAt: new Date('2026-05-02T00:00:00.000Z'),
			searchEndsAt: new Date('2026-05-15T00:00:00.000Z')
		});

		const result = await resolvePublicBookingSlots({
			bookingType: 'general',
			requesterEmail: 'person@example.com',
			now: new Date('2026-04-30T00:00:00.000Z'),
			slotProfile: {
				earliestDayOffset: 2,
				latestDayOffset: 14,
				maxSlotsPerDayPeriod: 2,
				timeZone: 'Europe/Berlin'
			}
		});

		expect(result.slotGroups).toHaveLength(13);
		expect(result.slotGroups.flatMap((day) => day.slots)).toHaveLength(78);
		expect(result.slotGroups[0]?.slots.map((slot) => slot.startsAtIso)).toEqual([
			'2026-05-02T06:00:00.000Z',
			'2026-05-02T07:00:00.000Z',
			'2026-05-02T10:00:00.000Z',
			'2026-05-02T11:00:00.000Z',
			'2026-05-02T15:00:00.000Z',
			'2026-05-02T16:00:00.000Z'
		]);
	});

	it('returns updated pause message for globally paused public flows', () => {
		const message = getPublicBookingUnavailableMessage({
			state: 'globally_paused',
			bookingType: 'general',
			pause: {
				isPaused: true,
				pauseMessage: 'Bookings are paused for travel week',
				settingsRowId: 'settings-22',
				updatedAt: new Date('2026-05-02T00:00:00.000Z')
			},
			rules: null
		});

		expect(message).toBe('Bookings are paused for travel week');
	});
});
