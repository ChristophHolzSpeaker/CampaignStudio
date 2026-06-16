import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/bookings', () => ({
	resolvePublicBookingSlotPreview: vi.fn()
}));

import { resolvePublicBookingSlotPreview } from '$lib/server/bookings';
import { getSpeakerBookingSlotPreview } from './speaker-booking-slots.remote';

const mockedResolvePublicBookingSlotPreview = vi.mocked(resolvePublicBookingSlotPreview);

describe('/speaker/[slug] booking slots remote', () => {
	it('returns slot groups from the deferred booking preview', async () => {
		mockedResolvePublicBookingSlotPreview.mockResolvedValueOnce({
			availability: { state: 'available' } as never,
			searchStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			searchEndsAt: new Date('2026-05-04T10:00:00.000Z'),
			slotGroups: [
				{
					dateKey: '2026-05-02',
					slots: [
						{
							startsAtIso: '2026-05-02T10:00:00.000Z',
							endsAtIso: '2026-05-02T10:30:00.000Z'
						}
					]
				}
			]
		} as never);

		const result = (await getSpeakerBookingSlotPreview()) as { slotGroups: unknown[] };

		expect(mockedResolvePublicBookingSlotPreview).toHaveBeenCalledWith({ bookingType: 'lead' });
		expect(result.slotGroups).toHaveLength(1);
	});
});
