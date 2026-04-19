import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/bookings', () => ({
	confirmBookingSelection: vi.fn(),
	getBookingPolicy: vi.fn(),
	getPublicBookingUnavailableMessage: vi.fn(),
	resolveLeadBookingToken: vi.fn(),
	resolvePublicBookingSlots: vi.fn()
}));

import {
	confirmBookingSelection,
	getBookingPolicy,
	getPublicBookingUnavailableMessage,
	resolveLeadBookingToken,
	resolvePublicBookingSlots
} from '$lib/server/bookings';
import { actions, load } from './+page.server';

const mockedGetBookingPolicy = vi.mocked(getBookingPolicy);
const mockedGetPublicBookingUnavailableMessage = vi.mocked(getPublicBookingUnavailableMessage);
const mockedResolveLeadBookingToken = vi.mocked(resolveLeadBookingToken);
const mockedResolvePublicBookingSlots = vi.mocked(resolvePublicBookingSlots);
const mockedConfirmBookingSelection = vi.mocked(confirmBookingSelection);

describe('/book/l/[token] +page.server', () => {
	beforeEach(() => {
		mockedConfirmBookingSelection.mockReset();
		mockedGetBookingPolicy.mockReset();
		mockedGetPublicBookingUnavailableMessage.mockReset();
		mockedResolveLeadBookingToken.mockReset();
		mockedResolvePublicBookingSlots.mockReset();
	});

	it('load returns invalid token state', async () => {
		mockedResolveLeadBookingToken.mockResolvedValueOnce({
			state: 'invalid',
			reason: 'not_found'
		});

		const result = (await load({ params: { token: 'missing-token' } } as never)) as any;

		expect(result.tokenState).toBe('invalid');
		expect(result.tokenMessage).toContain('invalid');
		expect(mockedGetBookingPolicy).not.toHaveBeenCalled();
	});

	it('load returns expired token state', async () => {
		mockedResolveLeadBookingToken.mockResolvedValueOnce({
			state: 'expired',
			context: {
				bookingType: 'lead',
				token: 'expired-token',
				bookingLinkId: 'link-1',
				leadJourneyId: 'journey-1',
				campaignId: 10,
				expiresAt: new Date('2026-05-01T00:00:00.000Z'),
				clickedAt: null,
				bookedAt: null,
				metadata: null
			}
		});

		const result = (await load({ params: { token: 'expired-token' } } as never)) as any;

		expect(result.tokenState).toBe('expired');
		expect(result.tokenMessage).toContain('expired');
		expect(mockedGetBookingPolicy).not.toHaveBeenCalled();
	});

	it('load returns paused state when token is usable but bookings are paused', async () => {
		mockedResolveLeadBookingToken.mockResolvedValueOnce({
			state: 'usable',
			context: {
				bookingType: 'lead',
				token: 'usable-token',
				bookingLinkId: 'link-2',
				leadJourneyId: 'journey-2',
				campaignId: 11,
				expiresAt: new Date('2026-06-01T00:00:00.000Z'),
				clickedAt: null,
				bookedAt: null,
				metadata: null
			}
		});
		mockedGetBookingPolicy.mockResolvedValueOnce({
			state: 'globally_paused',
			bookingType: 'lead',
			pause: {
				isPaused: true,
				pauseMessage: 'Bookings paused',
				settingsRowId: 'settings-1',
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			},
			rules: null
		});
		mockedGetPublicBookingUnavailableMessage.mockReturnValueOnce('Bookings paused');

		const result = (await load({ params: { token: 'usable-token' } } as never)) as any;

		expect(result.tokenState).toBe('usable');
		expect(result.policyState).toBe('globally_paused');
		expect(result.unavailableMessage).toBe('Bookings paused');
	});

	it('action rejects when token is invalid', async () => {
		mockedResolveLeadBookingToken.mockResolvedValueOnce({
			state: 'invalid',
			reason: 'not_found'
		});

		const formData = new FormData();
		formData.set('email', 'person@example.com');
		formData.set('scope', 'Lead call');

		const response = (await actions.default({
			params: { token: 'missing-token' },
			request: new Request('http://test.local/book/l/missing-token', {
				method: 'POST',
				body: formData
			})
		} as never)) as any;

		expect(response.status).toBe(400);
		expect(response.data.message).toContain('invalid');
	});

	it('action returns available slots for lead booking type', async () => {
		mockedResolveLeadBookingToken.mockResolvedValueOnce({
			state: 'usable',
			context: {
				bookingType: 'lead',
				token: 'usable-token',
				bookingLinkId: 'link-3',
				leadJourneyId: 'journey-3',
				campaignId: 12,
				expiresAt: new Date('2026-06-01T00:00:00.000Z'),
				clickedAt: null,
				bookedAt: null,
				metadata: null
			}
		});
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
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			}
		});
		mockedResolvePublicBookingSlots.mockResolvedValueOnce({
			classification: {
				email: 'lead@example.com',
				normalizedEmail: 'lead@example.com',
				hasPriorBookings: true,
				hasUpcomingBooking: true,
				interactionKind: 'repeat',
				upcomingBooking: {
					bookingId: 'booking-1',
					status: 'confirmed',
					startsAt: new Date('2026-05-01T10:00:00.000Z'),
					endsAt: new Date('2026-05-01T10:30:00.000Z'),
					bookingType: 'lead',
					isRepeatInteraction: true
				},
				recentBooking: null,
				totalBookings: 3
			},
			availability: {
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
		formData.set('email', 'lead@example.com');
		formData.set('scope', 'Lead discovery call');

		const response = (await actions.default({
			params: { token: 'usable-token' },
			request: new Request('http://test.local/book/l/usable-token', {
				method: 'POST',
				body: formData
			})
		} as never)) as any;

		expect(mockedResolvePublicBookingSlots).toHaveBeenCalledWith({
			bookingType: 'lead',
			requesterEmail: 'lead@example.com'
		});
		expect(response.availabilityState).toBe('available');
		expect(response.slotGroups).toHaveLength(1);
	});

	it('confirm action returns confirmed state for usable lead token', async () => {
		mockedResolveLeadBookingToken.mockResolvedValueOnce({
			state: 'usable',
			context: {
				bookingType: 'lead',
				token: 'usable-token',
				bookingLinkId: 'link-4',
				leadJourneyId: 'journey-4',
				campaignId: 14,
				expiresAt: new Date('2026-06-01T00:00:00.000Z'),
				clickedAt: null,
				bookedAt: null,
				metadata: null
			}
		});
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
				updatedAt: new Date('2026-04-17T00:00:00.000Z')
			}
		});
		mockedConfirmBookingSelection.mockResolvedValueOnce({
			state: 'confirmed',
			calendarEventId: 'evt_222',
			calendarEventUrl: null,
			booking: {
				id: 'booking-2'
			} as never
		});

		const formData = new FormData();
		formData.set('email', 'lead@example.com');
		formData.set('scope', 'Lead call');
		formData.set('selected_starts_at', '2026-06-01T10:00:00.000Z');
		formData.set('selected_ends_at', '2026-06-01T10:30:00.000Z');

		const response = (await actions.confirm({
			params: { token: 'usable-token' },
			request: new Request('http://test.local/book/l/usable-token', {
				method: 'POST',
				body: formData
			})
		} as never)) as any;

		expect(mockedConfirmBookingSelection).toHaveBeenCalledWith(
			expect.objectContaining({
				bookingType: 'lead',
				leadTokenContext: expect.objectContaining({
					bookingLinkId: 'link-4'
				})
			})
		);
		expect(response.confirmationState).toBe('confirmed');
		expect(response.confirmedBookingId).toBe('booking-2');
	});

	it('confirm action rejects when token is invalid during submit', async () => {
		mockedResolveLeadBookingToken.mockResolvedValueOnce({
			state: 'invalid',
			reason: 'not_found'
		});

		const formData = new FormData();
		formData.set('email', 'lead@example.com');
		formData.set('scope', 'Lead call');
		formData.set('selected_starts_at', '2026-06-01T10:00:00.000Z');
		formData.set('selected_ends_at', '2026-06-01T10:30:00.000Z');

		const response = (await actions.confirm({
			params: { token: 'invalid-token' },
			request: new Request('http://test.local/book/l/invalid-token', {
				method: 'POST',
				body: formData
			})
		} as never)) as any;

		expect(response.status).toBe(400);
		expect(response.data.message).toContain('invalid');
	});
});
