import { WorkerCalendarAvailabilityProvider } from './calendar-provider';
import { getBookingAvailability } from './availability-service';
import type {
	BookingAvailabilityResult,
	BookingPolicyResult,
	BookingRequesterClassification,
	BookingType
} from './contracts';
import { classifyBookingRequesterByEmail } from './requester-classification';
import { getBookingWindowConfig } from './booking-window';
import { PUBLIC_BOOKING_CALENDAR_ID } from '$env/static/public';

export const PUBLIC_BOOKING_SLOT_WINDOW_DAYS = 3;
export const PUBLIC_BOOKING_LEAD_WORKING_DAYS = 3;
export const PUBLIC_BOOKING_SLOT_LIMIT = 40;

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

export type PublicBookingSlotPreview = {
	availability: BookingAvailabilityResult;
	searchStartsAt: Date;
	searchEndsAt: Date;
	slotGroups: PublicBookingSlotDayGroup[];
};

function isWeekdayInTimeZone(date: Date, timeZone: string): boolean {
	const weekday = new Intl.DateTimeFormat('en-US', {
		timeZone,
		weekday: 'short'
	}).format(date);

	return weekday !== 'Sat' && weekday !== 'Sun';
}

function getLeadCalendarWindowDays(input: {
	now: Date;
	timeZone: string;
	targetWorkingDays: number;
}): number {
	let countedWorkingDays = 0;
	let daysOffset = 0;

	while (countedWorkingDays < input.targetWorkingDays) {
		const candidate = new Date(input.now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
		if (isWeekdayInTimeZone(candidate, input.timeZone)) {
			countedWorkingDays += 1;
		}

		daysOffset += 1;
	}

	return daysOffset;
}

export function getPublicBookingSearchWindow(input?: {
	now?: Date;
	windowDays?: number;
	bookingType?: BookingType;
}): {
	searchStartsAt: Date;
	searchEndsAt: Date;
} {
	const now = input?.now ?? new Date();
	const bookingType = input?.bookingType ?? 'general';
	const windowDays =
		input?.windowDays ??
		(bookingType === 'lead'
			? getLeadCalendarWindowDays({
					now,
					timeZone: getBookingWindowConfig().timeZone,
					targetWorkingDays: PUBLIC_BOOKING_LEAD_WORKING_DAYS
				})
			: PUBLIC_BOOKING_SLOT_WINDOW_DAYS);
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

export function createPublicBookingCalendarProvider(): WorkerCalendarAvailabilityProvider {
	return new WorkerCalendarAvailabilityProvider();
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
	const { searchStartsAt, searchEndsAt } = getPublicBookingSearchWindow({
		now,
		bookingType: input.bookingType
	});

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

export async function resolvePublicBookingSlotPreview(input: {
	bookingType: BookingType;
	now?: Date;
}): Promise<PublicBookingSlotPreview> {
	const now = input.now ?? new Date();
	const { searchStartsAt, searchEndsAt } = getPublicBookingSearchWindow({
		now,
		bookingType: input.bookingType
	});

	const availability = await getBookingAvailability({
		bookingType: input.bookingType,
		searchStartsAt,
		searchEndsAt,
		calendarProvider: createPublicBookingCalendarProvider(),
		calendarId: PUBLIC_BOOKING_CALENDAR_ID,
		now
	});

	return {
		availability,
		searchStartsAt,
		searchEndsAt,
		slotGroups: toSlotGroups(availability)
	};
}
