import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./repository', () => ({
	getBookingByRescheduleToken: vi.fn(),
	getOverlappingActiveBooking: vi.fn(),
	updateBookingStatus: vi.fn()
}));

vi.mock('./policy', () => ({
	getBookingPolicy: vi.fn()
}));

vi.mock('./availability-service', () => ({
	getBookingAvailability: vi.fn()
}));

vi.mock('./lifecycle', () => ({
	rescheduleBooking: vi.fn()
}));

vi.mock('./worker-calendar-client', () => ({
	updateBookingCalendarEventViaWorker: vi.fn()
}));

vi.mock('$lib/server/notifications/telegram', () => ({
	notifyBookingRescheduled: vi.fn()
}));

import {
	getBookingByRescheduleToken,
	getOverlappingActiveBooking,
	updateBookingStatus
} from './repository';
import { getBookingPolicy } from './policy';
import { getBookingAvailability } from './availability-service';
import { rescheduleBooking } from './lifecycle';
import { updateBookingCalendarEventViaWorker } from './worker-calendar-client';
import { notifyBookingRescheduled } from '$lib/server/notifications/telegram';
import { confirmBookingReschedule, resolveRescheduleBookingFlow } from './reschedule-service';

const mockedGetBookingByRescheduleToken = vi.mocked(getBookingByRescheduleToken);
const mockedGetOverlappingActiveBooking = vi.mocked(getOverlappingActiveBooking);
const mockedUpdateBookingStatus = vi.mocked(updateBookingStatus);
const mockedGetBookingPolicy = vi.mocked(getBookingPolicy);
const mockedGetBookingAvailability = vi.mocked(getBookingAvailability);
const mockedRescheduleBooking = vi.mocked(rescheduleBooking);
const mockedUpdateBookingCalendarEventViaWorker = vi.mocked(updateBookingCalendarEventViaWorker);
const mockedNotifyBookingRescheduled = vi.mocked(notifyBookingRescheduled);

const existingBooking = {
	id: 'booking-1',
	booking_type: 'lead' as const,
	lead_journey_id: 'journey-1',
	email: 'lead@example.com',
	name: 'Lead User',
	company: 'ACME',
	scope: 'Discuss launch',
	status: 'confirmed' as const,
	starts_at: new Date('2026-06-01T10:00:00.000Z'),
	ends_at: new Date('2026-06-01T10:30:00.000Z'),
	google_calendar_event_id: 'evt_123',
	calendar_sync_error: null,
	reschedule_token: 'resched-1',
	booking_confirmation_email_sent_at: null,
	booking_confirmation_email_provider_message_id: null,
	is_repeat_interaction: false,
	created_at: new Date('2026-05-01T00:00:00.000Z'),
	updated_at: new Date('2026-05-01T00:00:00.000Z')
};

describe('reschedule service', () => {
	beforeEach(() => {
		mockedGetBookingByRescheduleToken.mockReset();
		mockedGetOverlappingActiveBooking.mockReset();
		mockedUpdateBookingStatus.mockReset();
		mockedGetBookingPolicy.mockReset();
		mockedGetBookingAvailability.mockReset();
		mockedRescheduleBooking.mockReset();
		mockedUpdateBookingCalendarEventViaWorker.mockReset();
		mockedNotifyBookingRescheduled.mockReset();
	});

	it('resolveRescheduleBookingFlow returns invalid token state', async () => {
		mockedGetBookingByRescheduleToken.mockResolvedValueOnce(null);

		const result = await resolveRescheduleBookingFlow({
			rescheduleToken: 'missing-token',
			now: new Date('2026-05-20T00:00:00.000Z')
		});

		expect(result.resolution.state).toBe('invalid_token');
		expect(result.slotGroups).toHaveLength(0);
	});

	it('resolveRescheduleBookingFlow returns replacement slot groups', async () => {
		mockedGetBookingByRescheduleToken.mockResolvedValueOnce(existingBooking as never);
		mockedGetBookingAvailability.mockResolvedValueOnce({
			state: 'available',
			policy: {
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
					advanceNoticeMinutes: 30,
					slotDurationMinutes: 30,
					slotIntervalMinutes: 30,
					isEnabled: true,
					ruleRowId: 'rule-lead',
					updatedAt: new Date('2026-05-20T00:00:00.000Z')
				}
			},
			slots: [
				{
					startsAt: new Date('2026-06-01T10:00:00.000Z'),
					endsAt: new Date('2026-06-01T10:30:00.000Z'),
					bookingType: 'lead',
					source: 'computed'
				},
				{
					startsAt: new Date('2026-06-01T11:00:00.000Z'),
					endsAt: new Date('2026-06-01T11:30:00.000Z'),
					bookingType: 'lead',
					source: 'computed'
				}
			],
			searchStartsAt: new Date('2026-05-20T00:00:00.000Z'),
			searchEndsAt: new Date('2026-05-23T00:00:00.000Z')
		});

		const result = await resolveRescheduleBookingFlow({
			rescheduleToken: 'resched-1',
			now: new Date('2026-05-20T00:00:00.000Z')
		});

		expect(result.resolution.state).toBe('usable');
		expect(result.slotGroups).toHaveLength(1);
		expect(result.slotGroups[0]?.slots).toHaveLength(1);
		expect(result.slotGroups[0]?.slots[0]?.startsAtIso).toBe('2026-06-01T11:00:00.000Z');
	});

	it('confirmBookingReschedule succeeds, updates booking, audit, and worker event update', async () => {
		mockedGetBookingByRescheduleToken.mockResolvedValueOnce(existingBooking as never);
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
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-lead',
				updatedAt: new Date('2026-05-20T00:00:00.000Z')
			}
		});
		mockedGetOverlappingActiveBooking.mockResolvedValueOnce(null);
		mockedGetBookingAvailability.mockResolvedValueOnce({
			state: 'available',
			policy: {
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
					advanceNoticeMinutes: 30,
					slotDurationMinutes: 30,
					slotIntervalMinutes: 30,
					isEnabled: true,
					ruleRowId: 'rule-lead',
					updatedAt: new Date('2026-05-20T00:00:00.000Z')
				}
			},
			slots: [
				{
					startsAt: new Date('2026-06-01T11:00:00.000Z'),
					endsAt: new Date('2026-06-01T11:30:00.000Z'),
					bookingType: 'lead',
					source: 'computed'
				}
			],
			searchStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			searchEndsAt: new Date('2026-06-01T11:30:00.000Z')
		});
		mockedRescheduleBooking.mockResolvedValueOnce({
			booking: {
				...existingBooking,
				starts_at: new Date('2026-06-01T11:00:00.000Z'),
				ends_at: new Date('2026-06-01T11:30:00.000Z')
			},
			audit: {
				id: 'audit-1'
			} as never
		});
		mockedUpdateBookingCalendarEventViaWorker.mockResolvedValueOnce({
			ok: true,
			event_id: 'evt_123'
		});
		mockedUpdateBookingStatus.mockResolvedValueOnce({
			...existingBooking,
			status: 'confirmed',
			starts_at: new Date('2026-06-01T11:00:00.000Z'),
			ends_at: new Date('2026-06-01T11:30:00.000Z')
		} as never);

		const result = await confirmBookingReschedule({
			rescheduleToken: 'resched-1',
			selectedStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			selectedEndsAt: new Date('2026-06-01T11:30:00.000Z'),
			requestOrigin: 'https://book.example.com',
			now: new Date('2026-05-31T00:00:00.000Z')
		});

		expect(mockedRescheduleBooking).toHaveBeenCalledWith({
			rescheduleToken: 'resched-1',
			newStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			newEndsAt: new Date('2026-06-01T11:30:00.000Z'),
			changedBy: 'lead'
		});
		expect(mockedUpdateBookingCalendarEventViaWorker).toHaveBeenCalledWith(
			expect.objectContaining({
				event_id: 'evt_123'
			})
		);
		expect(mockedNotifyBookingRescheduled).toHaveBeenCalledWith(
			expect.objectContaining({
				booking_id: 'booking-1',
				booking_type: 'lead'
			})
		);
		expect(result.state).toBe('rescheduled');
		if (result.state === 'rescheduled') {
			expect(result.booking.starts_at.toISOString()).toBe('2026-06-01T11:00:00.000Z');
			expect(result.audit.id).toBe('audit-1');
		}
	});

	it('confirmBookingReschedule returns slot unavailable when replacement slot is no longer available', async () => {
		mockedGetBookingByRescheduleToken.mockResolvedValueOnce(existingBooking as never);
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
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-lead',
				updatedAt: new Date('2026-05-20T00:00:00.000Z')
			}
		});
		mockedGetOverlappingActiveBooking.mockResolvedValueOnce(null);
		mockedGetBookingAvailability.mockResolvedValueOnce({
			state: 'no_slots',
			policy: {
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
					advanceNoticeMinutes: 30,
					slotDurationMinutes: 30,
					slotIntervalMinutes: 30,
					isEnabled: true,
					ruleRowId: 'rule-lead',
					updatedAt: new Date('2026-05-20T00:00:00.000Z')
				}
			},
			slots: [],
			searchStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			searchEndsAt: new Date('2026-06-01T11:30:00.000Z')
		});

		const result = await confirmBookingReschedule({
			rescheduleToken: 'resched-1',
			selectedStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			selectedEndsAt: new Date('2026-06-01T11:30:00.000Z'),
			requestOrigin: 'https://book.example.com',
			now: new Date('2026-05-31T00:00:00.000Z')
		});

		expect(result.state).toBe('slot_unavailable');
		expect(mockedRescheduleBooking).not.toHaveBeenCalled();
	});

	it('confirmBookingReschedule marks calendar_sync_failed when worker update fails', async () => {
		mockedGetBookingByRescheduleToken.mockResolvedValueOnce(existingBooking as never);
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
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-lead',
				updatedAt: new Date('2026-05-20T00:00:00.000Z')
			}
		});
		mockedGetOverlappingActiveBooking.mockResolvedValueOnce(null);
		mockedGetBookingAvailability.mockResolvedValueOnce({
			state: 'available',
			policy: {
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
					advanceNoticeMinutes: 30,
					slotDurationMinutes: 30,
					slotIntervalMinutes: 30,
					isEnabled: true,
					ruleRowId: 'rule-lead',
					updatedAt: new Date('2026-05-20T00:00:00.000Z')
				}
			},
			slots: [
				{
					startsAt: new Date('2026-06-01T11:00:00.000Z'),
					endsAt: new Date('2026-06-01T11:30:00.000Z'),
					bookingType: 'lead',
					source: 'computed'
				}
			],
			searchStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			searchEndsAt: new Date('2026-06-01T11:30:00.000Z')
		});
		mockedRescheduleBooking.mockResolvedValueOnce({
			booking: {
				...existingBooking,
				starts_at: new Date('2026-06-01T11:00:00.000Z'),
				ends_at: new Date('2026-06-01T11:30:00.000Z')
			},
			audit: {
				id: 'audit-1'
			} as never
		});
		mockedUpdateBookingCalendarEventViaWorker.mockRejectedValueOnce(new Error('worker error'));
		mockedUpdateBookingStatus.mockResolvedValueOnce({
			...existingBooking,
			status: 'calendar_sync_failed',
			calendar_sync_error: 'worker error'
		} as never);

		const result = await confirmBookingReschedule({
			rescheduleToken: 'resched-1',
			selectedStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			selectedEndsAt: new Date('2026-06-01T11:30:00.000Z'),
			requestOrigin: 'https://book.example.com',
			now: new Date('2026-05-31T00:00:00.000Z')
		});

		expect(mockedUpdateBookingStatus).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'calendar_sync_failed'
			})
		);
		expect(mockedNotifyBookingRescheduled).not.toHaveBeenCalled();
		expect(result.state).toBe('calendar_sync_failed');
	});

	it('keeps reschedule successful when telegram notification fails', async () => {
		mockedGetBookingByRescheduleToken.mockResolvedValueOnce(existingBooking as never);
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
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-lead',
				updatedAt: new Date('2026-05-20T00:00:00.000Z')
			}
		});
		mockedGetOverlappingActiveBooking.mockResolvedValueOnce(null);
		mockedGetBookingAvailability.mockResolvedValueOnce({
			state: 'available',
			policy: {
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
					advanceNoticeMinutes: 30,
					slotDurationMinutes: 30,
					slotIntervalMinutes: 30,
					isEnabled: true,
					ruleRowId: 'rule-lead',
					updatedAt: new Date('2026-05-20T00:00:00.000Z')
				}
			},
			slots: [
				{
					startsAt: new Date('2026-06-01T11:00:00.000Z'),
					endsAt: new Date('2026-06-01T11:30:00.000Z'),
					bookingType: 'lead',
					source: 'computed'
				}
			],
			searchStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			searchEndsAt: new Date('2026-06-01T11:30:00.000Z')
		});
		mockedRescheduleBooking.mockResolvedValueOnce({
			booking: {
				...existingBooking,
				starts_at: new Date('2026-06-01T11:00:00.000Z'),
				ends_at: new Date('2026-06-01T11:30:00.000Z')
			},
			audit: {
				id: 'audit-2'
			} as never
		});
		mockedUpdateBookingCalendarEventViaWorker.mockResolvedValueOnce({
			ok: true,
			event_id: 'evt_123'
		});
		mockedUpdateBookingStatus.mockResolvedValueOnce({
			...existingBooking,
			status: 'confirmed',
			starts_at: new Date('2026-06-01T11:00:00.000Z'),
			ends_at: new Date('2026-06-01T11:30:00.000Z')
		} as never);
		mockedNotifyBookingRescheduled.mockRejectedValueOnce(new Error('telegram down'));

		const result = await confirmBookingReschedule({
			rescheduleToken: 'resched-1',
			selectedStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			selectedEndsAt: new Date('2026-06-01T11:30:00.000Z'),
			requestOrigin: 'https://book.example.com',
			now: new Date('2026-05-31T00:00:00.000Z')
		});

		expect(result.state).toBe('rescheduled');
	});

	it('confirmBookingReschedule fails when booking is missing calendar event id', async () => {
		mockedGetBookingByRescheduleToken.mockResolvedValueOnce({
			...existingBooking,
			google_calendar_event_id: null
		} as never);
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
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-lead',
				updatedAt: new Date('2026-05-20T00:00:00.000Z')
			}
		});
		mockedGetOverlappingActiveBooking.mockResolvedValueOnce(null);
		mockedGetBookingAvailability.mockResolvedValueOnce({
			state: 'available',
			policy: {
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
					advanceNoticeMinutes: 30,
					slotDurationMinutes: 30,
					slotIntervalMinutes: 30,
					isEnabled: true,
					ruleRowId: 'rule-lead',
					updatedAt: new Date('2026-05-20T00:00:00.000Z')
				}
			},
			slots: [
				{
					startsAt: new Date('2026-06-01T11:00:00.000Z'),
					endsAt: new Date('2026-06-01T11:30:00.000Z'),
					bookingType: 'lead',
					source: 'computed'
				}
			],
			searchStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			searchEndsAt: new Date('2026-06-01T11:30:00.000Z')
		});

		const result = await confirmBookingReschedule({
			rescheduleToken: 'resched-1',
			selectedStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			selectedEndsAt: new Date('2026-06-01T11:30:00.000Z'),
			requestOrigin: 'https://book.example.com',
			now: new Date('2026-05-31T00:00:00.000Z')
		});

		expect(result.state).toBe('missing_calendar_event_id');
		expect(mockedRescheduleBooking).not.toHaveBeenCalled();
	});

	it('confirmBookingReschedule rechecks paused/disabled policy at confirmation time', async () => {
		mockedGetBookingByRescheduleToken.mockResolvedValueOnce(existingBooking as never);
		mockedGetBookingPolicy.mockResolvedValueOnce({
			state: 'globally_paused',
			bookingType: 'lead',
			pause: {
				isPaused: true,
				pauseMessage: 'Bookings are paused',
				settingsRowId: 'settings-1',
				updatedAt: new Date('2026-05-31T00:00:00.000Z')
			},
			rules: {
				bookingType: 'lead',
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-lead',
				updatedAt: new Date('2026-05-20T00:00:00.000Z')
			}
		});

		const result = await confirmBookingReschedule({
			rescheduleToken: 'resched-1',
			selectedStartsAt: new Date('2026-06-01T11:00:00.000Z'),
			selectedEndsAt: new Date('2026-06-01T11:30:00.000Z'),
			requestOrigin: 'https://book.example.com',
			now: new Date('2026-05-31T00:00:00.000Z')
		});

		expect(result.state).toBe('booking_unavailable');
		expect(mockedRescheduleBooking).not.toHaveBeenCalled();
	});
});
