import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./policy', () => ({
	getBookingPolicy: vi.fn()
}));

vi.mock('./requester-classification', () => ({
	classifyBookingRequesterByEmail: vi.fn()
}));

vi.mock('./lifecycle', () => ({
	createBooking: vi.fn(),
	attachBookingCalendarEventId: vi.fn(),
	markBookingCalendarSyncFailed: vi.fn()
}));

vi.mock('./repository', () => ({
	getOverlappingActiveBooking: vi.fn(),
	markBookingLinkBookedAt: vi.fn()
}));

vi.mock('$lib/server/notifications/telegram', () => ({
	notifyBookingConfirmed: vi.fn()
}));

import { getBookingPolicy } from './policy';
import { classifyBookingRequesterByEmail } from './requester-classification';
import {
	createBooking,
	attachBookingCalendarEventId,
	markBookingCalendarSyncFailed
} from './lifecycle';
import { getOverlappingActiveBooking, markBookingLinkBookedAt } from './repository';
import { notifyBookingConfirmed } from '$lib/server/notifications/telegram';
import { confirmBookingSelection } from './confirmation-service';

const mockedGetBookingPolicy = vi.mocked(getBookingPolicy);
const mockedClassifyBookingRequesterByEmail = vi.mocked(classifyBookingRequesterByEmail);
const mockedCreateBooking = vi.mocked(createBooking);
const mockedAttachBookingCalendarEventId = vi.mocked(attachBookingCalendarEventId);
const mockedMarkBookingCalendarSyncFailed = vi.mocked(markBookingCalendarSyncFailed);
const mockedGetOverlappingActiveBooking = vi.mocked(getOverlappingActiveBooking);
const mockedMarkBookingLinkBookedAt = vi.mocked(markBookingLinkBookedAt);
const mockedNotifyBookingConfirmed = vi.mocked(notifyBookingConfirmed);

function activePolicy(bookingType: 'general' | 'lead') {
	return {
		state: 'active' as const,
		bookingType,
		pause: {
			isPaused: false,
			pauseMessage: null,
			settingsRowId: null,
			updatedAt: null
		},
		rules: {
			bookingType,
			advanceNoticeMinutes: 30,
			slotDurationMinutes: 30,
			slotIntervalMinutes: 30,
			isEnabled: true,
			ruleRowId: `rule-${bookingType}`,
			updatedAt: new Date('2026-04-17T00:00:00.000Z')
		}
	};
}

describe('confirmBookingSelection', () => {
	beforeEach(() => {
		mockedGetBookingPolicy.mockReset();
		mockedClassifyBookingRequesterByEmail.mockReset();
		mockedCreateBooking.mockReset();
		mockedAttachBookingCalendarEventId.mockReset();
		mockedMarkBookingCalendarSyncFailed.mockReset();
		mockedGetOverlappingActiveBooking.mockReset();
		mockedMarkBookingLinkBookedAt.mockReset();
		mockedNotifyBookingConfirmed.mockReset();
	});

	it('confirms general booking and attaches returned calendar event id', async () => {
		mockedGetBookingPolicy.mockResolvedValueOnce(activePolicy('general'));
		mockedGetOverlappingActiveBooking.mockResolvedValueOnce(null);
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
		mockedCreateBooking.mockResolvedValueOnce({
			booking: {
				id: 'booking-1',
				booking_type: 'general',
				lead_journey_id: null,
				email: 'person@example.com',
				name: 'Person',
				company: 'ACME',
				scope: 'Discuss campaign strategy',
				status: 'pending_calendar_sync',
				starts_at: new Date('2026-06-01T10:00:00.000Z'),
				ends_at: new Date('2026-06-01T10:30:00.000Z'),
				google_calendar_event_id: null,
				calendar_sync_error: null,
				reschedule_token: null,
				is_repeat_interaction: false,
				created_at: new Date('2026-04-01T00:00:00.000Z'),
				updated_at: new Date('2026-04-01T00:00:00.000Z')
			}
		});
		mockedAttachBookingCalendarEventId.mockResolvedValueOnce({
			booking: {
				id: 'booking-1',
				booking_type: 'general',
				lead_journey_id: null,
				email: 'person@example.com',
				name: 'Person',
				company: 'ACME',
				scope: 'Discuss campaign strategy',
				status: 'confirmed',
				starts_at: new Date('2026-06-01T10:00:00.000Z'),
				ends_at: new Date('2026-06-01T10:30:00.000Z'),
				google_calendar_event_id: 'evt_123',
				calendar_sync_error: null,
				reschedule_token: 'resched-token',
				is_repeat_interaction: false,
				created_at: new Date('2026-04-01T00:00:00.000Z'),
				updated_at: new Date('2026-04-01T00:00:00.000Z')
			}
		});

		const createBookingEvent = vi.fn().mockResolvedValue({
			ok: true as const,
			event_id: 'evt_123'
		});

		const result = await confirmBookingSelection(
			{
				bookingType: 'general',
				intake: {
					email: 'person@example.com',
					name: 'Person',
					company: 'ACME',
					scope: 'Discuss campaign strategy'
				},
				selectedStartsAt: new Date('2026-06-01T10:00:00.000Z'),
				selectedEndsAt: new Date('2026-06-01T10:30:00.000Z'),
				requestOrigin: 'https://book.example.com',
				now: new Date('2026-06-01T09:00:00.000Z')
			},
			{
				calendarEventProvider: {
					createBookingEvent
				}
			}
		);

		expect(result.state).toBe('confirmed');
		expect(mockedCreateBooking).toHaveBeenCalledTimes(1);
		expect(mockedCreateBooking.mock.calls[0]?.[0].rescheduleToken).toBeTruthy();
		expect(createBookingEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				booking_id: 'booking-1',
				booking_type: 'general',
				reschedule_url: expect.stringContaining('/book/r/')
			})
		);
		expect(mockedAttachBookingCalendarEventId).toHaveBeenCalledWith({
			bookingId: 'booking-1',
			googleCalendarEventId: 'evt_123'
		});
		expect(mockedNotifyBookingConfirmed).toHaveBeenCalledWith(
			expect.objectContaining({
				booking_id: 'booking-1',
				booking_type: 'general'
			})
		);
	});

	it('confirms lead booking and marks booking link booked timestamp', async () => {
		mockedGetBookingPolicy.mockResolvedValueOnce(activePolicy('lead'));
		mockedGetOverlappingActiveBooking.mockResolvedValueOnce(null);
		mockedClassifyBookingRequesterByEmail.mockResolvedValueOnce({
			email: 'lead@example.com',
			normalizedEmail: 'lead@example.com',
			hasPriorBookings: true,
			hasUpcomingBooking: false,
			interactionKind: 'repeat',
			upcomingBooking: null,
			recentBooking: null,
			totalBookings: 2
		});
		mockedCreateBooking.mockResolvedValueOnce({
			booking: {
				id: 'booking-2',
				booking_type: 'lead',
				lead_journey_id: 'journey-1',
				email: 'lead@example.com',
				name: null,
				company: null,
				scope: 'Lead call',
				status: 'pending_calendar_sync',
				starts_at: new Date('2026-06-01T11:00:00.000Z'),
				ends_at: new Date('2026-06-01T11:30:00.000Z'),
				google_calendar_event_id: null,
				calendar_sync_error: null,
				reschedule_token: null,
				is_repeat_interaction: true,
				created_at: new Date('2026-04-01T00:00:00.000Z'),
				updated_at: new Date('2026-04-01T00:00:00.000Z')
			}
		});
		mockedAttachBookingCalendarEventId.mockResolvedValueOnce({
			booking: {
				id: 'booking-2',
				booking_type: 'lead',
				lead_journey_id: 'journey-1',
				email: 'lead@example.com',
				name: null,
				company: null,
				scope: 'Lead call',
				status: 'confirmed',
				starts_at: new Date('2026-06-01T11:00:00.000Z'),
				ends_at: new Date('2026-06-01T11:30:00.000Z'),
				google_calendar_event_id: 'evt_lead',
				calendar_sync_error: null,
				reschedule_token: 'resched-token',
				is_repeat_interaction: true,
				created_at: new Date('2026-04-01T00:00:00.000Z'),
				updated_at: new Date('2026-04-01T00:00:00.000Z')
			}
		});

		const createBookingEvent = vi.fn().mockResolvedValue({
			ok: true as const,
			event_id: 'evt_lead'
		});

		const result = await confirmBookingSelection(
			{
				bookingType: 'lead',
				intake: {
					email: 'lead@example.com',
					scope: 'Lead call'
				},
				selectedStartsAt: new Date('2026-06-01T11:00:00.000Z'),
				selectedEndsAt: new Date('2026-06-01T11:30:00.000Z'),
				requestOrigin: 'https://book.example.com',
				now: new Date('2026-06-01T10:00:00.000Z'),
				leadTokenContext: {
					token: 'token-1',
					bookingLinkId: 'booking-link-1',
					leadJourneyId: 'journey-1',
					campaignId: 88,
					metadata: null
				}
			},
			{
				calendarEventProvider: {
					createBookingEvent
				}
			}
		);

		expect(result.state).toBe('confirmed');
		expect(mockedMarkBookingLinkBookedAt).toHaveBeenCalledWith({
			bookingLinkId: 'booking-link-1',
			bookedAt: new Date('2026-06-01T10:00:00.000Z')
		});
		expect(mockedNotifyBookingConfirmed).toHaveBeenCalledWith(
			expect.objectContaining({
				booking_id: 'booking-2',
				campaign_context: expect.objectContaining({
					campaign_id: 88
				})
			})
		);
		expect(createBookingEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				lead_context: expect.objectContaining({
					lead_journey_id: 'journey-1',
					campaign_id: 88
				})
			})
		);
	});

	it('returns slot unavailable when overlap is detected', async () => {
		mockedGetBookingPolicy.mockResolvedValueOnce(activePolicy('general'));
		mockedGetOverlappingActiveBooking.mockResolvedValueOnce({
			id: 'booking-existing'
		} as never);

		const result = await confirmBookingSelection({
			bookingType: 'general',
			intake: {
				email: 'person@example.com',
				scope: 'Intro'
			},
			selectedStartsAt: new Date('2026-06-01T10:00:00.000Z'),
			selectedEndsAt: new Date('2026-06-01T10:30:00.000Z'),
			requestOrigin: 'https://book.example.com',
			now: new Date('2026-06-01T09:00:00.000Z')
		});

		expect(result.state).toBe('slot_unavailable');
		expect(mockedCreateBooking).not.toHaveBeenCalled();
	});

	it('marks booking as calendar sync failed when worker call fails', async () => {
		mockedGetBookingPolicy.mockResolvedValueOnce(activePolicy('general'));
		mockedGetOverlappingActiveBooking.mockResolvedValueOnce(null);
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
		mockedCreateBooking.mockResolvedValueOnce({
			booking: {
				id: 'booking-3',
				booking_type: 'general',
				lead_journey_id: null,
				email: 'person@example.com',
				name: null,
				company: null,
				scope: 'Intro',
				status: 'pending_calendar_sync',
				starts_at: new Date('2026-06-01T10:00:00.000Z'),
				ends_at: new Date('2026-06-01T10:30:00.000Z'),
				google_calendar_event_id: null,
				calendar_sync_error: null,
				reschedule_token: null,
				is_repeat_interaction: false,
				created_at: new Date('2026-04-01T00:00:00.000Z'),
				updated_at: new Date('2026-04-01T00:00:00.000Z')
			}
		});
		mockedMarkBookingCalendarSyncFailed.mockResolvedValueOnce({
			booking: {
				id: 'booking-3',
				booking_type: 'general',
				lead_journey_id: null,
				email: 'person@example.com',
				name: null,
				company: null,
				scope: 'Intro',
				status: 'calendar_sync_failed',
				starts_at: new Date('2026-06-01T10:00:00.000Z'),
				ends_at: new Date('2026-06-01T10:30:00.000Z'),
				google_calendar_event_id: null,
				calendar_sync_error: 'worker error',
				reschedule_token: 'token',
				is_repeat_interaction: false,
				created_at: new Date('2026-04-01T00:00:00.000Z'),
				updated_at: new Date('2026-04-01T00:00:00.000Z')
			}
		});

		const result = await confirmBookingSelection(
			{
				bookingType: 'general',
				intake: {
					email: 'person@example.com',
					scope: 'Intro'
				},
				selectedStartsAt: new Date('2026-06-01T10:00:00.000Z'),
				selectedEndsAt: new Date('2026-06-01T10:30:00.000Z'),
				requestOrigin: 'https://book.example.com',
				now: new Date('2026-06-01T09:00:00.000Z')
			},
			{
				calendarEventProvider: {
					createBookingEvent: vi.fn().mockRejectedValueOnce(new Error('worker error'))
				}
			}
		);

		expect(result.state).toBe('calendar_sync_failed');
		expect(mockedMarkBookingCalendarSyncFailed).toHaveBeenCalledWith({
			bookingId: 'booking-3',
			errorMessage: 'worker error'
		});
		expect(mockedNotifyBookingConfirmed).not.toHaveBeenCalled();
	});

	it('does not fail confirmed booking when telegram notification fails', async () => {
		mockedGetBookingPolicy.mockResolvedValueOnce(activePolicy('general'));
		mockedGetOverlappingActiveBooking.mockResolvedValueOnce(null);
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
		mockedCreateBooking.mockResolvedValueOnce({
			booking: {
				id: 'booking-4',
				booking_type: 'general',
				lead_journey_id: null,
				email: 'person@example.com',
				name: 'Person',
				company: null,
				scope: 'Intro',
				status: 'pending_calendar_sync',
				starts_at: new Date('2026-06-01T10:00:00.000Z'),
				ends_at: new Date('2026-06-01T10:30:00.000Z'),
				google_calendar_event_id: null,
				calendar_sync_error: null,
				reschedule_token: null,
				is_repeat_interaction: false,
				created_at: new Date('2026-04-01T00:00:00.000Z'),
				updated_at: new Date('2026-04-01T00:00:00.000Z')
			}
		});
		mockedAttachBookingCalendarEventId.mockResolvedValueOnce({
			booking: {
				id: 'booking-4',
				booking_type: 'general',
				lead_journey_id: null,
				email: 'person@example.com',
				name: 'Person',
				company: null,
				scope: 'Intro',
				status: 'confirmed',
				starts_at: new Date('2026-06-01T10:00:00.000Z'),
				ends_at: new Date('2026-06-01T10:30:00.000Z'),
				google_calendar_event_id: 'evt_999',
				calendar_sync_error: null,
				reschedule_token: 'resched-token',
				is_repeat_interaction: false,
				created_at: new Date('2026-04-01T00:00:00.000Z'),
				updated_at: new Date('2026-04-01T00:00:00.000Z')
			}
		});
		mockedNotifyBookingConfirmed.mockRejectedValueOnce(new Error('telegram down'));

		const result = await confirmBookingSelection(
			{
				bookingType: 'general',
				intake: {
					email: 'person@example.com',
					scope: 'Intro',
					name: 'Person'
				},
				selectedStartsAt: new Date('2026-06-01T10:00:00.000Z'),
				selectedEndsAt: new Date('2026-06-01T10:30:00.000Z'),
				requestOrigin: 'https://book.example.com',
				now: new Date('2026-06-01T09:00:00.000Z')
			},
			{
				calendarEventProvider: {
					createBookingEvent: vi.fn().mockResolvedValueOnce({ ok: true, event_id: 'evt_999' })
				}
			}
		);

		expect(result.state).toBe('confirmed');
	});

	it('returns booking unavailable when policy is no longer active', async () => {
		mockedGetBookingPolicy.mockResolvedValueOnce({
			state: 'type_disabled',
			bookingType: 'general',
			pause: {
				isPaused: false,
				pauseMessage: null,
				settingsRowId: null,
				updatedAt: null
			},
			rules: {
				bookingType: 'general',
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: false,
				ruleRowId: 'rule-general',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			}
		});

		const result = await confirmBookingSelection({
			bookingType: 'general',
			intake: {
				email: 'person@example.com',
				scope: 'Intro'
			},
			selectedStartsAt: new Date('2026-06-01T10:00:00.000Z'),
			selectedEndsAt: new Date('2026-06-01T10:30:00.000Z'),
			requestOrigin: 'https://book.example.com',
			now: new Date('2026-06-01T09:00:00.000Z')
		});

		expect(result.state).toBe('booking_unavailable');
		expect(mockedCreateBooking).not.toHaveBeenCalled();
	});
});
