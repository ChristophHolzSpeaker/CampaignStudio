import type { PublicBookingSlotProfile } from '$lib/server/bookings';
import { getBookingWindowConfig } from '$lib/server/bookings/booking-window';

export const SPECIAL_BOOKING_EARLIEST_DAY_OFFSET = 2;
export const SPECIAL_BOOKING_LATEST_DAY_OFFSET = 14;
export const SPECIAL_BOOKING_SLOTS_PER_DAY_PERIOD = 2;

export const SPECIAL_BOOKING_NO_SLOTS_MESSAGE =
	'No briefing slots are currently available from 2 days from now through the next 2 weeks.';

export function getSpecialBookingSlotProfile(): PublicBookingSlotProfile {
	return {
		earliestDayOffset: SPECIAL_BOOKING_EARLIEST_DAY_OFFSET,
		latestDayOffset: SPECIAL_BOOKING_LATEST_DAY_OFFSET,
		maxSlotsPerDayPeriod: SPECIAL_BOOKING_SLOTS_PER_DAY_PERIOD,
		timeZone: getBookingWindowConfig().timeZone
	};
}
