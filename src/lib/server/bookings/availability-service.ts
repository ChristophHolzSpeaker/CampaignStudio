import type { BookingAvailabilityResult, BookingType } from './contracts';
import type { BookingCalendarAvailabilityProvider } from './calendar-provider';
import { getBookingPolicy } from './policy';
import { evaluateBookingAvailability } from './slot-engine';

export async function getBookingAvailability(input: {
	bookingType: BookingType;
	searchStartsAt: Date;
	searchEndsAt: Date;
	calendarProvider: BookingCalendarAvailabilityProvider;
	calendarId?: string;
	now?: Date;
}): Promise<BookingAvailabilityResult> {
	const policy = await getBookingPolicy(input.bookingType);

	if (policy.state !== 'active') {
		return evaluateBookingAvailability({
			policy,
			searchStartsAt: input.searchStartsAt,
			searchEndsAt: input.searchEndsAt,
			busyIntervals: [],
			now: input.now
		});
	}

	const busy = await input.calendarProvider.fetchBusyIntervals({
		rangeStartsAt: input.searchStartsAt,
		rangeEndsAt: input.searchEndsAt,
		calendarId: input.calendarId
	});

	return evaluateBookingAvailability({
		policy,
		searchStartsAt: input.searchStartsAt,
		searchEndsAt: input.searchEndsAt,
		busyIntervals: busy.intervals,
		now: input.now
	});
}
