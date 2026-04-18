import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/bookings', () => ({
	confirmBookingReschedule: vi.fn(),
	resolveRescheduleBookingFlow: vi.fn()
}));

import { confirmBookingReschedule, resolveRescheduleBookingFlow } from '$lib/server/bookings';
import { actions, load } from './+page.server';

const mockedConfirmBookingReschedule = vi.mocked(confirmBookingReschedule);
const mockedResolveRescheduleBookingFlow = vi.mocked(resolveRescheduleBookingFlow);

describe('/book/r/[token] +page.server', () => {
	beforeEach(() => {
		mockedConfirmBookingReschedule.mockReset();
		mockedResolveRescheduleBookingFlow.mockReset();
	});

	it('load returns invalid token state', async () => {
		mockedResolveRescheduleBookingFlow.mockResolvedValueOnce({
			resolution: {
				state: 'invalid_token',
				booking: null,
				availability: null,
				searchStartsAt: null,
				searchEndsAt: null,
				message: 'This reschedule link is invalid.'
			},
			slotGroups: []
		} as never);

		const result = (await load({ params: { token: 'missing-token' } } as never)) as any;

		expect(result.tokenState).toBe('invalid_token');
		expect(result.currentBooking).toBeNull();
	});

	it('load returns current booking and replacement slots for usable token', async () => {
		mockedResolveRescheduleBookingFlow.mockResolvedValueOnce({
			resolution: {
				state: 'usable',
				booking: {
					id: 'booking-1',
					booking_type: 'lead',
					email: 'lead@example.com',
					name: 'Lead',
					scope: 'Call',
					starts_at: new Date('2026-06-01T10:00:00.000Z'),
					ends_at: new Date('2026-06-01T10:30:00.000Z')
				} as never,
				availability: { state: 'available' } as never,
				searchStartsAt: new Date('2026-05-30T00:00:00.000Z'),
				searchEndsAt: new Date('2026-06-02T00:00:00.000Z'),
				message: null
			},
			slotGroups: [
				{
					dateKey: '2026-06-01',
					slots: [
						{
							startsAtIso: '2026-06-01T11:00:00.000Z',
							endsAtIso: '2026-06-01T11:30:00.000Z'
						}
					]
				}
			]
		} as never);

		const result = (await load({ params: { token: 'resched-1' } } as never)) as any;

		expect(result.tokenState).toBe('usable');
		expect(result.currentBooking.id).toBe('booking-1');
		expect(result.slotGroups).toHaveLength(1);
	});

	it('confirm action returns rescheduled state', async () => {
		mockedConfirmBookingReschedule.mockResolvedValueOnce({
			state: 'rescheduled',
			booking: {
				id: 'booking-1',
				starts_at: new Date('2026-06-01T11:00:00.000Z'),
				ends_at: new Date('2026-06-01T11:30:00.000Z')
			} as never,
			audit: {
				id: 'audit-1'
			} as never
		});

		const formData = new FormData();
		formData.set('selected_starts_at', '2026-06-01T11:00:00.000Z');
		formData.set('selected_ends_at', '2026-06-01T11:30:00.000Z');

		const response = (await actions.confirm({
			params: { token: 'resched-1' },
			request: new Request('http://test.local/book/r/resched-1', {
				method: 'POST',
				body: formData
			})
		} as never)) as any;

		expect(mockedConfirmBookingReschedule).toHaveBeenCalledWith(
			expect.objectContaining({
				rescheduleToken: 'resched-1'
			})
		);
		expect(response.confirmationState).toBe('rescheduled');
		expect(response.updatedBookingId).toBe('booking-1');
	});

	it('confirm action returns failure when token is invalid at submit time', async () => {
		mockedConfirmBookingReschedule.mockResolvedValueOnce({
			state: 'invalid_token',
			message: 'This reschedule link is invalid.'
		});
		mockedResolveRescheduleBookingFlow.mockResolvedValueOnce({
			resolution: {
				state: 'invalid_token',
				booking: null,
				availability: null,
				searchStartsAt: null,
				searchEndsAt: null,
				message: 'This reschedule link is invalid.'
			},
			slotGroups: []
		} as never);

		const formData = new FormData();
		formData.set('selected_starts_at', '2026-06-01T11:00:00.000Z');
		formData.set('selected_ends_at', '2026-06-01T11:30:00.000Z');

		const response = (await actions.confirm({
			params: { token: 'invalid-token' },
			request: new Request('http://test.local/book/r/invalid-token', {
				method: 'POST',
				body: formData
			})
		} as never)) as any;

		expect(response.status).toBe(400);
		expect(response.data.confirmationState).toBe('invalid_token');
	});
});
