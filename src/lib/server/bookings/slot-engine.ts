import type {
	BookingAvailabilityResult,
	BookingPolicyResult,
	BookingSlot,
	BookingSlotRequestInput,
	BookingSlotResult,
	CalendarBusyInterval
} from './contracts';
import { isSlotInsideBookingWindow } from './booking-window';

function toMs(minutes: number): number {
	return minutes * 60 * 1000;
}

function overlaps(aStart: Date, aEnd: Date, b: CalendarBusyInterval): boolean {
	return aStart < b.endsAt && aEnd > b.startsAt;
}

function roundUpToInterval(date: Date, intervalMinutes: number): Date {
	const intervalMs = toMs(intervalMinutes);
	const roundedMs = Math.ceil(date.getTime() / intervalMs) * intervalMs;
	return new Date(roundedMs);
}

export function generateBookingSlots(input: BookingSlotRequestInput): BookingSlotResult {
	if (input.searchEndsAt <= input.searchStartsAt) {
		return {
			state: 'invalid_window',
			slots: [],
			searchStartsAt: input.searchStartsAt,
			searchEndsAt: input.searchEndsAt
		};
	}

	const now = input.now ?? new Date();
	const noticeCutoff = new Date(now.getTime() + toMs(input.rules.advanceNoticeMinutes));
	const effectiveStart =
		noticeCutoff > input.searchStartsAt ? noticeCutoff : new Date(input.searchStartsAt.getTime());

	const slotDurationMs = toMs(input.rules.slotDurationMinutes);
	const intervalMinutes = input.rules.slotIntervalMinutes;

	if (slotDurationMs <= 0 || intervalMinutes <= 0) {
		return {
			state: 'invalid_window',
			slots: [],
			searchStartsAt: input.searchStartsAt,
			searchEndsAt: input.searchEndsAt
		};
	}

	const candidateStart = roundUpToInterval(effectiveStart, intervalMinutes);
	const busyIntervals = [...input.busyIntervals].sort(
		(a, b) => a.startsAt.getTime() - b.startsAt.getTime()
	);

	const slots: BookingSlot[] = [];
	for (
		let startsAt = candidateStart;
		startsAt.getTime() + slotDurationMs <= input.searchEndsAt.getTime();
		startsAt = new Date(startsAt.getTime() + toMs(intervalMinutes))
	) {
		const endsAt = new Date(startsAt.getTime() + slotDurationMs);
		const hasConflict = busyIntervals.some((busy) => overlaps(startsAt, endsAt, busy));
		if (hasConflict) {
			continue;
		}

		if (!isSlotInsideBookingWindow({ startsAt, endsAt })) {
			continue;
		}

		slots.push({
			startsAt,
			endsAt,
			bookingType: input.bookingType,
			source: 'computed'
		});
	}

	return {
		state: slots.length > 0 ? 'slots_available' : 'no_slots',
		slots,
		searchStartsAt: input.searchStartsAt,
		searchEndsAt: input.searchEndsAt
	};
}

export function evaluateBookingAvailability(input: {
	policy: BookingPolicyResult;
	searchStartsAt: Date;
	searchEndsAt: Date;
	busyIntervals: CalendarBusyInterval[];
	now?: Date;
}): BookingAvailabilityResult {
	if (input.policy.state === 'globally_paused') {
		return {
			state: 'bookings_paused',
			policy: input.policy,
			slots: [],
			searchStartsAt: input.searchStartsAt,
			searchEndsAt: input.searchEndsAt,
			reason: input.policy.pause.pauseMessage ?? 'Bookings are currently paused'
		};
	}

	if (input.policy.state === 'rules_missing') {
		return {
			state: 'rules_missing',
			policy: input.policy,
			slots: [],
			searchStartsAt: input.searchStartsAt,
			searchEndsAt: input.searchEndsAt,
			reason: 'Booking rules are not configured'
		};
	}

	if (input.policy.state === 'type_disabled') {
		return {
			state: 'booking_type_disabled',
			policy: input.policy,
			slots: [],
			searchStartsAt: input.searchStartsAt,
			searchEndsAt: input.searchEndsAt,
			reason: `Booking type ${input.policy.bookingType} is disabled`
		};
	}

	const slotResult = generateBookingSlots({
		bookingType: input.policy.bookingType,
		searchStartsAt: input.searchStartsAt,
		searchEndsAt: input.searchEndsAt,
		rules: input.policy.rules,
		busyIntervals: input.busyIntervals,
		now: input.now
	});

	if (slotResult.state === 'invalid_window') {
		return {
			state: 'invalid_window',
			policy: input.policy,
			slots: [],
			searchStartsAt: slotResult.searchStartsAt,
			searchEndsAt: slotResult.searchEndsAt,
			reason: 'Invalid search window for slot generation'
		};
	}

	if (slotResult.state === 'no_slots') {
		return {
			state: 'no_slots',
			policy: input.policy,
			slots: [],
			searchStartsAt: slotResult.searchStartsAt,
			searchEndsAt: slotResult.searchEndsAt
		};
	}

	return {
		state: 'available',
		policy: input.policy,
		slots: slotResult.slots,
		searchStartsAt: slotResult.searchStartsAt,
		searchEndsAt: slotResult.searchEndsAt
	};
}
