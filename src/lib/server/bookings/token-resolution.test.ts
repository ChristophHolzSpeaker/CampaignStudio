import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./repository', () => ({
	getBookingLinkByToken: vi.fn()
}));

import { getBookingLinkByToken } from './repository';
import { resolveLeadBookingToken } from './token-resolution';

const mockedGetBookingLinkByToken = vi.mocked(getBookingLinkByToken);

describe('resolveLeadBookingToken', () => {
	beforeEach(() => {
		mockedGetBookingLinkByToken.mockReset();
	});

	it('returns invalid when token row does not exist', async () => {
		mockedGetBookingLinkByToken.mockResolvedValueOnce(null);

		const result = await resolveLeadBookingToken('missing-token');

		expect(result).toEqual({
			state: 'invalid',
			reason: 'not_found'
		});
	});

	it('returns invalid when token exists for non-lead type', async () => {
		mockedGetBookingLinkByToken.mockResolvedValueOnce({
			id: 'link-1',
			token: 'token-1',
			booking_type: 'general',
			lead_journey_id: null,
			campaign_id: null,
			expires_at: new Date('2026-05-01T12:00:00.000Z'),
			clicked_at: null,
			booked_at: null,
			metadata: null,
			created_at: new Date('2026-04-01T00:00:00.000Z'),
			updated_at: new Date('2026-04-01T00:00:00.000Z')
		});

		const result = await resolveLeadBookingToken('token-1');

		expect(result).toEqual({
			state: 'invalid',
			reason: 'type_mismatch'
		});
	});

	it('returns expired when expiry is at or before now', async () => {
		mockedGetBookingLinkByToken.mockResolvedValueOnce({
			id: 'link-2',
			token: 'token-2',
			booking_type: 'lead',
			lead_journey_id: 'journey-1',
			campaign_id: 99,
			expires_at: new Date('2026-05-01T10:00:00.000Z'),
			clicked_at: null,
			booked_at: null,
			metadata: { source: 'test' },
			created_at: new Date('2026-04-01T00:00:00.000Z'),
			updated_at: new Date('2026-04-01T00:00:00.000Z')
		});

		const result = await resolveLeadBookingToken('token-2', {
			now: new Date('2026-05-01T10:00:00.000Z')
		});

		expect(result.state).toBe('expired');
		if (result.state === 'expired') {
			expect(result.context.bookingLinkId).toBe('link-2');
			expect(result.context.leadJourneyId).toBe('journey-1');
		}
	});

	it('returns usable when lead token is unexpired', async () => {
		mockedGetBookingLinkByToken.mockResolvedValueOnce({
			id: 'link-3',
			token: 'token-3',
			booking_type: 'lead',
			lead_journey_id: null,
			campaign_id: null,
			expires_at: new Date('2026-05-01T11:00:00.000Z'),
			clicked_at: new Date('2026-05-01T09:00:00.000Z'),
			booked_at: null,
			metadata: null,
			created_at: new Date('2026-04-01T00:00:00.000Z'),
			updated_at: new Date('2026-04-01T00:00:00.000Z')
		});

		const result = await resolveLeadBookingToken('token-3', {
			now: new Date('2026-05-01T10:00:00.000Z')
		});

		expect(result.state).toBe('usable');
		if (result.state === 'usable') {
			expect(result.context.bookingLinkId).toBe('link-3');
			expect(result.context.token).toBe('token-3');
		}
	});
});
