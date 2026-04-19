import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./repository', () => ({
	getBookingsByEmail: vi.fn(),
	getUpcomingConfirmedBookingByEmail: vi.fn()
}));

import { getBookingsByEmail, getUpcomingConfirmedBookingByEmail } from './repository';
import { classifyBookingRequesterByEmail } from './requester-classification';

const mockedGetBookingsByEmail = vi.mocked(getBookingsByEmail);
const mockedGetUpcomingConfirmedBookingByEmail = vi.mocked(getUpcomingConfirmedBookingByEmail);

describe('classifyBookingRequesterByEmail', () => {
	beforeEach(() => {
		mockedGetBookingsByEmail.mockReset();
		mockedGetUpcomingConfirmedBookingByEmail.mockReset();
	});

	it('throws for invalid email input', async () => {
		await expect(classifyBookingRequesterByEmail('not-an-email')).rejects.toThrow(
			'Invalid email address for booking requester classification'
		);
	});

	it('returns first_time classification when no prior bookings exist', async () => {
		mockedGetBookingsByEmail.mockResolvedValueOnce([]);
		mockedGetUpcomingConfirmedBookingByEmail.mockResolvedValueOnce(null);

		const result = await classifyBookingRequesterByEmail('  PERSON@Example.com  ');

		expect(mockedGetBookingsByEmail).toHaveBeenCalledWith('person@example.com', { limit: 200 });
		expect(result.normalizedEmail).toBe('person@example.com');
		expect(result.interactionKind).toBe('first_time');
		expect(result.hasPriorBookings).toBe(false);
		expect(result.hasUpcomingBooking).toBe(false);
		expect(result.recentBooking).toBeNull();
		expect(result.upcomingBooking).toBeNull();
	});

	it('returns repeat classification with recent and upcoming summary', async () => {
		const upcoming = {
			id: 'booking-upcoming',
			booking_type: 'lead' as const,
			lead_journey_id: null,
			email: 'repeat@example.com',
			name: 'Repeat Lead',
			company: 'Acme',
			scope: 'Discovery call',
			status: 'confirmed' as const,
			starts_at: new Date('2026-06-01T10:00:00.000Z'),
			ends_at: new Date('2026-06-01T10:30:00.000Z'),
			google_calendar_event_id: null,
			calendar_sync_error: null,
			reschedule_token: 'resched-1',
			booking_confirmation_email_sent_at: null,
			booking_confirmation_email_provider_message_id: null,
			is_repeat_interaction: true,
			created_at: new Date('2026-05-20T00:00:00.000Z'),
			updated_at: new Date('2026-05-20T00:00:00.000Z')
		};

		const latest = {
			...upcoming,
			id: 'booking-latest',
			starts_at: new Date('2026-05-20T10:00:00.000Z'),
			ends_at: new Date('2026-05-20T10:30:00.000Z')
		};

		mockedGetBookingsByEmail.mockResolvedValueOnce([latest]);
		mockedGetUpcomingConfirmedBookingByEmail.mockResolvedValueOnce(upcoming);

		const result = await classifyBookingRequesterByEmail('repeat@example.com');

		expect(result.interactionKind).toBe('repeat');
		expect(result.hasPriorBookings).toBe(true);
		expect(result.hasUpcomingBooking).toBe(true);
		expect(result.totalBookings).toBe(1);
		expect(result.recentBooking?.bookingId).toBe('booking-latest');
		expect(result.upcomingBooking?.bookingId).toBe('booking-upcoming');
	});
});
