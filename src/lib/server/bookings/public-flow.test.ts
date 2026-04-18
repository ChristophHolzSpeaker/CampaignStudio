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
	PUBLIC_BOOKING_SLOT_WINDOW_DAYS
} from './public-flow';

const mockedGetBookingAvailability = vi.mocked(getBookingAvailability);
const mockedClassifyBookingRequesterByEmail = vi.mocked(classifyBookingRequesterByEmail);

describe('public booking flow service', () => {
	beforeEach(() => {
		mockedGetBookingAvailability.mockReset();
		mockedClassifyBookingRequesterByEmail.mockReset();
	});

	it('creates a default 3-day search window', () => {
		const now = new Date('2026-05-01T10:00:00.000Z');
		const result = getPublicBookingSearchWindow({ now });

		expect(result.searchStartsAt.toISOString()).toBe('2026-05-01T10:00:00.000Z');
		expect(result.searchEndsAt.toISOString()).toBe('2026-05-04T10:00:00.000Z');
		expect(PUBLIC_BOOKING_SLOT_WINDOW_DAYS).toBe(3);
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
