import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./repository', () => ({
	createBookingRecord: vi.fn(),
	createBookingRescheduleAudit: vi.fn(),
	getBookingByRescheduleToken: vi.fn(),
	updateBookingGoogleEventId: vi.fn(),
	updateBookingRepeatInteraction: vi.fn(),
	updateBookingSchedule: vi.fn()
}));

import {
	createBookingRecord,
	createBookingRescheduleAudit,
	getBookingByRescheduleToken,
	updateBookingGoogleEventId,
	updateBookingRepeatInteraction,
	updateBookingSchedule
} from './repository';
import {
	attachBookingCalendarEventId,
	createBooking,
	markBookingRepeatInteraction,
	rescheduleBooking
} from './lifecycle';

const mockedCreateBookingRecord = vi.mocked(createBookingRecord);
const mockedCreateBookingRescheduleAudit = vi.mocked(createBookingRescheduleAudit);
const mockedGetBookingByRescheduleToken = vi.mocked(getBookingByRescheduleToken);
const mockedUpdateBookingGoogleEventId = vi.mocked(updateBookingGoogleEventId);
const mockedUpdateBookingRepeatInteraction = vi.mocked(updateBookingRepeatInteraction);
const mockedUpdateBookingSchedule = vi.mocked(updateBookingSchedule);

describe('booking lifecycle services', () => {
	beforeEach(() => {
		mockedCreateBookingRecord.mockReset();
		mockedCreateBookingRescheduleAudit.mockReset();
		mockedGetBookingByRescheduleToken.mockReset();
		mockedUpdateBookingGoogleEventId.mockReset();
		mockedUpdateBookingRepeatInteraction.mockReset();
		mockedUpdateBookingSchedule.mockReset();
	});

	it('createBooking returns created booking from repository', async () => {
		mockedCreateBookingRecord.mockResolvedValueOnce({
			id: 'booking-1',
			booking_type: 'lead',
			lead_journey_id: null,
			email: 'lead@example.com',
			name: null,
			company: null,
			scope: 'Consultation',
			status: 'confirmed',
			starts_at: new Date('2026-05-01T10:00:00.000Z'),
			ends_at: new Date('2026-05-01T10:30:00.000Z'),
			google_calendar_event_id: null,
			reschedule_token: null,
			is_repeat_interaction: false,
			created_at: new Date('2026-04-01T00:00:00.000Z'),
			updated_at: new Date('2026-04-01T00:00:00.000Z')
		});

		const result = await createBooking({
			bookingType: 'lead',
			requester: {
				email: 'lead@example.com',
				scope: 'Consultation'
			},
			startsAt: new Date('2026-05-01T10:00:00.000Z'),
			endsAt: new Date('2026-05-01T10:30:00.000Z')
		});

		expect(result.booking.id).toBe('booking-1');
	});

	it('rescheduleBooking throws when token does not resolve to booking', async () => {
		mockedGetBookingByRescheduleToken.mockResolvedValueOnce(null);

		await expect(
			rescheduleBooking({
				rescheduleToken: 'missing-token',
				newStartsAt: new Date('2026-05-01T12:00:00.000Z'),
				newEndsAt: new Date('2026-05-01T12:30:00.000Z'),
				changedBy: 'lead'
			})
		).rejects.toThrow('Booking with this reschedule token was not found');
	});

	it('rescheduleBooking updates schedule and writes audit', async () => {
		mockedGetBookingByRescheduleToken.mockResolvedValueOnce({
			id: 'booking-2',
			booking_type: 'general',
			lead_journey_id: null,
			email: 'general@example.com',
			name: 'General',
			company: null,
			scope: 'Call',
			status: 'confirmed',
			starts_at: new Date('2026-05-01T10:00:00.000Z'),
			ends_at: new Date('2026-05-01T10:30:00.000Z'),
			google_calendar_event_id: null,
			reschedule_token: 'resched-2',
			is_repeat_interaction: false,
			created_at: new Date('2026-04-01T00:00:00.000Z'),
			updated_at: new Date('2026-04-01T00:00:00.000Z')
		});

		mockedUpdateBookingSchedule.mockResolvedValueOnce({
			id: 'booking-2',
			booking_type: 'general',
			lead_journey_id: null,
			email: 'general@example.com',
			name: 'General',
			company: null,
			scope: 'Call',
			status: 'confirmed',
			starts_at: new Date('2026-05-01T12:00:00.000Z'),
			ends_at: new Date('2026-05-01T12:30:00.000Z'),
			google_calendar_event_id: null,
			reschedule_token: 'resched-2',
			is_repeat_interaction: false,
			created_at: new Date('2026-04-01T00:00:00.000Z'),
			updated_at: new Date('2026-04-02T00:00:00.000Z')
		});

		mockedCreateBookingRescheduleAudit.mockResolvedValueOnce({
			id: 'audit-1',
			booking_id: 'booking-2',
			old_starts_at: new Date('2026-05-01T10:00:00.000Z'),
			old_ends_at: new Date('2026-05-01T10:30:00.000Z'),
			new_starts_at: new Date('2026-05-01T12:00:00.000Z'),
			new_ends_at: new Date('2026-05-01T12:30:00.000Z'),
			changed_by: 'lead',
			changed_at: new Date('2026-04-17T00:00:00.000Z')
		});

		const result = await rescheduleBooking({
			rescheduleToken: 'resched-2',
			newStartsAt: new Date('2026-05-01T12:00:00.000Z'),
			newEndsAt: new Date('2026-05-01T12:30:00.000Z'),
			changedBy: 'lead'
		});

		expect(mockedUpdateBookingSchedule).toHaveBeenCalledWith({
			bookingId: 'booking-2',
			startsAt: new Date('2026-05-01T12:00:00.000Z'),
			endsAt: new Date('2026-05-01T12:30:00.000Z')
		});
		expect(mockedCreateBookingRescheduleAudit).toHaveBeenCalledWith({
			bookingId: 'booking-2',
			oldStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			oldEndsAt: new Date('2026-05-01T10:30:00.000Z'),
			newStartsAt: new Date('2026-05-01T12:00:00.000Z'),
			newEndsAt: new Date('2026-05-01T12:30:00.000Z'),
			changedBy: 'lead'
		});
		expect(result.audit.id).toBe('audit-1');
	});

	it('attachBookingCalendarEventId and markBookingRepeatInteraction return updated bookings', async () => {
		mockedUpdateBookingGoogleEventId.mockResolvedValueOnce({
			id: 'booking-3',
			booking_type: 'lead',
			lead_journey_id: null,
			email: 'lead@example.com',
			name: null,
			company: null,
			scope: 'Consult',
			status: 'confirmed',
			starts_at: new Date('2026-05-01T10:00:00.000Z'),
			ends_at: new Date('2026-05-01T10:30:00.000Z'),
			google_calendar_event_id: 'evt_123',
			reschedule_token: null,
			is_repeat_interaction: false,
			created_at: new Date('2026-04-01T00:00:00.000Z'),
			updated_at: new Date('2026-04-02T00:00:00.000Z')
		});

		mockedUpdateBookingRepeatInteraction.mockResolvedValueOnce({
			id: 'booking-3',
			booking_type: 'lead',
			lead_journey_id: null,
			email: 'lead@example.com',
			name: null,
			company: null,
			scope: 'Consult',
			status: 'confirmed',
			starts_at: new Date('2026-05-01T10:00:00.000Z'),
			ends_at: new Date('2026-05-01T10:30:00.000Z'),
			google_calendar_event_id: 'evt_123',
			reschedule_token: null,
			is_repeat_interaction: true,
			created_at: new Date('2026-04-01T00:00:00.000Z'),
			updated_at: new Date('2026-04-02T00:00:00.000Z')
		});

		const attachResult = await attachBookingCalendarEventId({
			bookingId: 'booking-3',
			googleCalendarEventId: 'evt_123'
		});
		const repeatResult = await markBookingRepeatInteraction({
			bookingId: 'booking-3',
			isRepeatInteraction: true
		});

		expect(attachResult.booking.google_calendar_event_id).toBe('evt_123');
		expect(repeatResult.booking.is_repeat_interaction).toBe(true);
	});
});
