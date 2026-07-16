import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/bookings', () => ({
	confirmBookingSelection: vi.fn(),
	getBookingPolicy: vi.fn(),
	getPublicBookingUnavailableMessage: vi.fn(),
	isSlotInPublicBookingGroups: vi.fn(),
	resolvePublicBookingSlotPreview: vi.fn(),
	resolvePublicBookingSlots: vi.fn()
}));

vi.mock('$lib/server/notifications/booking-form-submission', () => ({
	notifyBookingFormSubmission: vi.fn()
}));

import {
	confirmBookingSelection,
	getBookingPolicy,
	getPublicBookingUnavailableMessage,
	isSlotInPublicBookingGroups,
	resolvePublicBookingSlotPreview,
	resolvePublicBookingSlots
} from '$lib/server/bookings';
import { notifyBookingFormSubmission } from '$lib/server/notifications/booking-form-submission';
import { actions, load } from './+page.server';

const mockedGetBookingPolicy = vi.mocked(getBookingPolicy);
const mockedGetPublicBookingUnavailableMessage = vi.mocked(getPublicBookingUnavailableMessage);
const mockedResolvePublicBookingSlotPreview = vi.mocked(resolvePublicBookingSlotPreview);
const mockedResolvePublicBookingSlots = vi.mocked(resolvePublicBookingSlots);
const mockedConfirmBookingSelection = vi.mocked(confirmBookingSelection);
const mockedIsSlotInPublicBookingGroups = vi.mocked(isSlotInPublicBookingGroups);
const mockedNotifyBookingFormSubmission = vi.mocked(notifyBookingFormSubmission);

describe('/book/s +page.server', () => {
	beforeEach(() => {
		mockedConfirmBookingSelection.mockReset();
		mockedGetBookingPolicy.mockReset();
		mockedGetPublicBookingUnavailableMessage.mockReset();
		mockedResolvePublicBookingSlotPreview.mockReset();
		mockedResolvePublicBookingSlots.mockReset();
		mockedIsSlotInPublicBookingGroups.mockReset();
		mockedNotifyBookingFormSubmission.mockReset();
		mockedResolvePublicBookingSlotPreview.mockResolvedValue({ slotGroups: [] } as never);
		mockedIsSlotInPublicBookingGroups.mockReturnValue(true);
		mockedNotifyBookingFormSubmission.mockResolvedValue(undefined);
	});

	it('load returns unavailable state when ruleset is disabled', async () => {
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
		mockedGetPublicBookingUnavailableMessage.mockReturnValueOnce('General booking is disabled.');

		const result = (await load({} as never)) as any;

		expect(result.policyState).toBe('type_disabled');
		expect(result.unavailableMessage).toBe('General booking is disabled.');
	});

	it('load returns slot preview when policy is active', async () => {
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
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-general',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			}
		});
		mockedResolvePublicBookingSlotPreview.mockResolvedValueOnce({
			availability: {
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
						advanceNoticeMinutes: 30,
						slotDurationMinutes: 30,
						slotIntervalMinutes: 30,
						isEnabled: true,
						ruleRowId: 'rule-general',
						updatedAt: new Date('2026-04-17T00:00:00.000Z')
					}
				},
				slots: [],
				searchStartsAt: new Date('2026-05-01T00:00:00.000Z'),
				searchEndsAt: new Date('2026-05-04T00:00:00.000Z')
			},
			searchStartsAt: new Date('2026-05-01T00:00:00.000Z'),
			searchEndsAt: new Date('2026-05-04T00:00:00.000Z'),
			slotGroups: [
				{
					dateKey: '2026-05-01',
					slots: [
						{
							startsAtIso: '2026-05-01T10:00:00.000Z',
							endsAtIso: '2026-05-01T10:30:00.000Z'
						}
					]
				}
			]
		});

		const result = (await load({} as never)) as any;

		expect(result.policyState).toBe('active');
		expect(result.availabilityState).toBe('available');
		expect(result.slotGroups).toHaveLength(1);
	});

	it('action returns validation errors for invalid intake', async () => {
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
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-general',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			}
		});

		const formData = new FormData();
		formData.set('email', 'not-an-email');
		formData.set('scope', '');

		const response = (await actions.check({
			request: new Request('http://test.local/book/s', { method: 'POST', body: formData })
		} as never)) as any;

		expect(response.status).toBe(400);
		expect(response.data.errors?.email).toBeTruthy();
		expect(response.data.errors?.scope).toBeTruthy();
	});

	it('action returns paused message when booking is globally paused', async () => {
		mockedGetBookingPolicy.mockResolvedValueOnce({
			state: 'globally_paused',
			bookingType: 'general',
			pause: {
				isPaused: true,
				pauseMessage: 'Paused for maintenance',
				settingsRowId: 'settings-1',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			},
			rules: null
		});
		mockedGetPublicBookingUnavailableMessage.mockReturnValueOnce('Paused for maintenance');

		const formData = new FormData();
		formData.set('email', 'person@example.com');
		formData.set('scope', 'Discovery call');

		const response = (await actions.check({
			request: new Request('http://test.local/book/s', { method: 'POST', body: formData })
		} as never)) as any;

		expect(response.status).toBe(409);
		expect(response.data.message).toBe('Paused for maintenance');
	});

	it('action returns available slots for general booking type', async () => {
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
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-general',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			}
		});
		mockedResolvePublicBookingSlots.mockResolvedValueOnce({
			classification: {
				email: 'person@example.com',
				normalizedEmail: 'person@example.com',
				hasPriorBookings: false,
				hasUpcomingBooking: false,
				interactionKind: 'first_time',
				upcomingBooking: null,
				recentBooking: null,
				totalBookings: 0
			},
			availability: {
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
						advanceNoticeMinutes: 30,
						slotDurationMinutes: 30,
						slotIntervalMinutes: 30,
						isEnabled: true,
						ruleRowId: 'rule-general',
						updatedAt: new Date('2026-04-17T00:00:00.000Z')
					}
				},
				slots: [],
				searchStartsAt: new Date('2026-05-01T00:00:00.000Z'),
				searchEndsAt: new Date('2026-05-04T00:00:00.000Z')
			},
			searchStartsAt: new Date('2026-05-01T00:00:00.000Z'),
			searchEndsAt: new Date('2026-05-04T00:00:00.000Z'),
			slotGroups: [
				{
					dateKey: '2026-05-01',
					slots: [
						{
							startsAtIso: '2026-05-01T10:00:00.000Z',
							endsAtIso: '2026-05-01T10:30:00.000Z'
						}
					]
				}
			]
		});

		const formData = new FormData();
		formData.set('email', 'person@example.com');
		formData.set('scope', 'Discovery call');

		const response = (await actions.check({
			request: new Request('http://test.local/book/s', { method: 'POST', body: formData })
		} as never)) as any;

		expect(mockedResolvePublicBookingSlots).toHaveBeenCalledWith({
			bookingType: 'general',
			requesterEmail: 'person@example.com',
			slotProfile: expect.objectContaining({
				earliestDayOffset: 2,
				latestDayOffset: 14,
				maxSlotsPerDayPeriod: 2
			})
		});
		expect(mockedNotifyBookingFormSubmission).toHaveBeenCalledWith(
			expect.objectContaining({
				flow: 'book_s',
				pagePath: '/book/s'
			})
		);
		expect(response.availabilityState).toBe('available');
		expect(response.slotGroups).toHaveLength(1);
	});

	it('action returns no-slots state for general booking type', async () => {
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
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-general',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			}
		});
		mockedResolvePublicBookingSlots.mockResolvedValueOnce({
			classification: {
				email: 'person@example.com',
				normalizedEmail: 'person@example.com',
				hasPriorBookings: true,
				hasUpcomingBooking: false,
				interactionKind: 'repeat',
				upcomingBooking: null,
				recentBooking: null,
				totalBookings: 2
			},
			availability: {
				state: 'no_slots',
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
						advanceNoticeMinutes: 30,
						slotDurationMinutes: 30,
						slotIntervalMinutes: 30,
						isEnabled: true,
						ruleRowId: 'rule-general',
						updatedAt: new Date('2026-04-17T00:00:00.000Z')
					}
				},
				slots: [],
				searchStartsAt: new Date('2026-05-01T00:00:00.000Z'),
				searchEndsAt: new Date('2026-05-04T00:00:00.000Z')
			},
			searchStartsAt: new Date('2026-05-01T00:00:00.000Z'),
			searchEndsAt: new Date('2026-05-04T00:00:00.000Z'),
			slotGroups: []
		});

		const formData = new FormData();
		formData.set('email', 'person@example.com');
		formData.set('scope', 'Discovery call');

		const response = (await actions.check({
			request: new Request('http://test.local/book/s', { method: 'POST', body: formData })
		} as never)) as any;

		expect(response.availabilityState).toBe('no_slots');
		expect(response.message).toContain('No briefing slots are currently available');
	});

	it('confirm action returns booking confirmed state', async () => {
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
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-general',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			}
		});
		mockedConfirmBookingSelection.mockResolvedValueOnce({
			state: 'confirmed',
			calendarEventId: 'evt_123',
			calendarEventUrl: null,
			booking: {
				id: 'booking-1'
			} as never
		});

		const formData = new FormData();
		formData.set('email', 'person@example.com');
		formData.set('scope', 'Discovery call');
		formData.set('selected_starts_at', '2026-06-01T10:00:00.000Z');
		formData.set('selected_ends_at', '2026-06-01T10:30:00.000Z');

		const response = (await actions.confirm({
			request: new Request('http://test.local/book/s', { method: 'POST', body: formData })
		} as never)) as any;

		expect(mockedConfirmBookingSelection).toHaveBeenCalledWith(
			expect.objectContaining({
				bookingType: 'general',
				requestOrigin: 'http://test.local'
			})
		);
		expect(response.confirmationState).toBe('confirmed');
		expect(response.confirmedBookingId).toBe('booking-1');
	});

	it('confirm action returns slot unavailable path', async () => {
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
				advanceNoticeMinutes: 30,
				slotDurationMinutes: 30,
				slotIntervalMinutes: 30,
				isEnabled: true,
				ruleRowId: 'rule-general',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			}
		});
		mockedIsSlotInPublicBookingGroups.mockReturnValueOnce(false);

		const formData = new FormData();
		formData.set('email', 'person@example.com');
		formData.set('scope', 'Discovery call');
		formData.set('selected_starts_at', '2026-06-01T10:00:00.000Z');
		formData.set('selected_ends_at', '2026-06-01T10:30:00.000Z');

		const response = (await actions.confirm({
			request: new Request('http://test.local/book/s', { method: 'POST', body: formData })
		} as never)) as any;

		expect(response.status).toBe(409);
		expect(response.data.confirmationState).toBe('slot_unavailable');
		expect(mockedConfirmBookingSelection).not.toHaveBeenCalled();
	});
});
