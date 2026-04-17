import { NoopCalendarAvailabilityProvider } from './calendar-provider';
import { getBookingAvailability } from './availability-service';
import type {
	BookingAvailabilityResult,
	BookingPolicyResult,
	BookingRequesterClassification,
	BookingType
} from './contracts';
import { classifyBookingRequesterByEmail } from './requester-classification';

export const PUBLIC_BOOKING_SLOT_WINDOW_DAYS = 3;
export const PUBLIC_BOOKING_SLOT_LIMIT = 40;
export const PUBLIC_BOOKING_CALENDAR_ID = 'speaker@christophholz.com';

export type PublicBookingSlotPresentation = {
	startsAtIso: string;
	endsAtIso: string;
};

export type PublicBookingSlotDayGroup = {
	dateKey: string;
	slots: PublicBookingSlotPresentation[];
};

export type PublicBookingResolution = {
	classification: BookingRequesterClassification;
	availability: BookingAvailabilityResult;
	searchStartsAt: Date;
	searchEndsAt: Date;
	slotGroups: PublicBookingSlotDayGroup[];
};

export function getPublicBookingSearchWindow(input?: { now?: Date; windowDays?: number }): {
	searchStartsAt: Date;
	searchEndsAt: Date;
} {
	const now = input?.now ?? new Date();
	const windowDays = input?.windowDays ?? PUBLIC_BOOKING_SLOT_WINDOW_DAYS;
	const searchStartsAt = new Date(now.getTime());
	const searchEndsAt = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

	return {
		searchStartsAt,
		searchEndsAt
	};
}

export function getPublicBookingUnavailableMessage(policy: BookingPolicyResult): string | null {
	if (policy.state === 'globally_paused') {
		return policy.pause.pauseMessage ?? 'Bookings are currently paused. Please check back soon.';
	}

	if (policy.state === 'type_disabled') {
		return 'Booking is currently unavailable for this route.';
	}

	if (policy.state === 'rules_missing') {
		return 'Booking is temporarily unavailable. Please check back soon.';
	}

	return null;
}

export function createPublicBookingCalendarProvider(): NoopCalendarAvailabilityProvider {
	return new NoopCalendarAvailabilityProvider();
}

function toSlotGroups(input: BookingAvailabilityResult): PublicBookingSlotDayGroup[] {
	const grouped = new Map<string, PublicBookingSlotPresentation[]>();

	for (const slot of input.slots.slice(0, PUBLIC_BOOKING_SLOT_LIMIT)) {
		const dateKey = slot.startsAt.toISOString().slice(0, 10);
		const existing = grouped.get(dateKey) ?? [];

		existing.push({
			startsAtIso: slot.startsAt.toISOString(),
			endsAtIso: slot.endsAt.toISOString()
		});

		grouped.set(dateKey, existing);
	}

	return [...grouped.entries()].map(([dateKey, slots]) => ({
		dateKey,
		slots
	}));
}

export async function resolvePublicBookingSlots(input: {
	bookingType: BookingType;
	requesterEmail: string;
	now?: Date;
}): Promise<PublicBookingResolution> {
	const now = input.now ?? new Date();
	const { searchStartsAt, searchEndsAt } = getPublicBookingSearchWindow({ now });

	const [classification, availability] = await Promise.all([
		classifyBookingRequesterByEmail(input.requesterEmail, { now }),
		getBookingAvailability({
			bookingType: input.bookingType,
			searchStartsAt,
			searchEndsAt,
			calendarProvider: createPublicBookingCalendarProvider(),
			calendarId: PUBLIC_BOOKING_CALENDAR_ID,
			now
		})
	]);

	return {
		classification,
		availability,
		searchStartsAt,
		searchEndsAt,
		slotGroups: toSlotGroups(availability)
	};
}
