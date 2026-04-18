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
	ignoredBusyIntervals?: Array<{ startsAt: Date; endsAt: Date }>;
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

	const ignoredBusyIntervals = input.ignoredBusyIntervals ?? [];
	const filteredBusyIntervals =
		ignoredBusyIntervals.length === 0
			? busy.intervals
			: busy.intervals.filter((busyInterval) => {
					return !ignoredBusyIntervals.some(
						(ignoredInterval) =>
							busyInterval.startsAt.getTime() === ignoredInterval.startsAt.getTime() &&
							busyInterval.endsAt.getTime() === ignoredInterval.endsAt.getTime()
					);
				});

	return evaluateBookingAvailability({
		policy,
		searchStartsAt: input.searchStartsAt,
		searchEndsAt: input.searchEndsAt,
		busyIntervals: filteredBusyIntervals,
		now: input.now
	});
}
