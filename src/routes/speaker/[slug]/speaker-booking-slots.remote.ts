import { query } from '$app/server';
import { resolvePublicBookingSlotPreview } from '$lib/server/bookings';

export const getSpeakerBookingSlotPreview = query(async () => {
	const slotPreview = await resolvePublicBookingSlotPreview({ bookingType: 'lead' });

	return {
		slotGroups: slotPreview.slotGroups
	};
});
