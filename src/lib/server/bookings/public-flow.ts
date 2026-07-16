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

export type PublicBookingSlotProfile = {
	earliestDayOffset: number;
	latestDayOffset: number;
	maxSlotsPerDayPeriod: number;
	timeZone?: string;
};

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

type LocalDateParts = {
	year: number;
	month: number;
	day: number;
};

type LocalDateTimeParts = LocalDateParts & {
	hour: number;
	minute: number;
	second: number;
};

type SlotDayPeriod = 'morning' | 'afternoon' | 'evening';

function getLocalDateTimeParts(date: Date, timeZone: string): LocalDateTimeParts {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(date);

	const readPart = (type: Intl.DateTimeFormatPartTypes): number =>
		Number(parts.find((part) => part.type === type)?.value ?? '0');

	return {
		year: readPart('year'),
		month: readPart('month'),
		day: readPart('day'),
		hour: readPart('hour'),
		minute: readPart('minute'),
		second: readPart('second')
	};
}

function addCalendarDays(input: LocalDateParts, days: number): LocalDateParts {
	const shifted = new Date(Date.UTC(input.year, input.month - 1, input.day + days));

	return {
		year: shifted.getUTCFullYear(),
		month: shifted.getUTCMonth() + 1,
		day: shifted.getUTCDate()
	};
}

function toStartOfDayInTimeZone(input: LocalDateParts, timeZone: string): Date {
	const desiredTimestamp = Date.UTC(input.year, input.month - 1, input.day);
	let candidate = new Date(desiredTimestamp);

	for (let attempt = 0; attempt < 3; attempt += 1) {
		const actual = getLocalDateTimeParts(candidate, timeZone);
		const actualTimestamp = Date.UTC(
			actual.year,
			actual.month - 1,
			actual.day,
			actual.hour,
			actual.minute,
			actual.second
		);
		const adjustment = desiredTimestamp - actualTimestamp;

		if (adjustment === 0) {
			return candidate;
		}

		candidate = new Date(candidate.getTime() + adjustment);
	}

	return candidate;
}

function toDateKey(input: LocalDateParts): string {
	return `${String(input.year).padStart(4, '0')}-${String(input.month).padStart(2, '0')}-${String(input.day).padStart(2, '0')}`;
}

function getSlotDayPeriod(hour: number): SlotDayPeriod {
	if (hour < 12) {
		return 'morning';
	}

	if (hour < 17) {
		return 'afternoon';
	}

	return 'evening';
}

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
	slotProfile?: PublicBookingSlotProfile;
}): {
	searchStartsAt: Date;
	searchEndsAt: Date;
} {
	const now = input?.now ?? new Date();
	const slotProfile = input?.slotProfile;

	if (slotProfile) {
		const timeZone = slotProfile.timeZone ?? getBookingWindowConfig().timeZone;
		const localNow = getLocalDateTimeParts(now, timeZone);
		const earliestDayOffset = Math.max(0, Math.trunc(slotProfile.earliestDayOffset));
		const latestDayOffset = Math.max(earliestDayOffset, Math.trunc(slotProfile.latestDayOffset));
		const searchStartsAt = toStartOfDayInTimeZone(
			addCalendarDays(localNow, earliestDayOffset),
			timeZone
		);
		const searchEndsAt = toStartOfDayInTimeZone(
			addCalendarDays(localNow, latestDayOffset + 1),
			timeZone
		);

		return {
			searchStartsAt,
			searchEndsAt
		};
	}

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

function toSlotGroups(
	input: BookingAvailabilityResult,
	slotProfile?: PublicBookingSlotProfile
): PublicBookingSlotDayGroup[] {
	const grouped = new Map<string, PublicBookingSlotPresentation[]>();
	const slots = slotProfile
		? [...input.slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
		: input.slots.slice(0, PUBLIC_BOOKING_SLOT_LIMIT);
	const periodCounts = new Map<string, number>();
	const maxSlotsPerDayPeriod = slotProfile
		? Math.max(1, Math.trunc(slotProfile.maxSlotsPerDayPeriod))
		: null;
	const timeZone = slotProfile?.timeZone ?? getBookingWindowConfig().timeZone;

	for (const slot of slots) {
		const localStart = slotProfile ? getLocalDateTimeParts(slot.startsAt, timeZone) : null;
		const dateKey = localStart ? toDateKey(localStart) : slot.startsAt.toISOString().slice(0, 10);

		if (localStart && maxSlotsPerDayPeriod !== null) {
			const periodKey = `${dateKey}:${getSlotDayPeriod(localStart.hour)}`;
			const currentCount = periodCounts.get(periodKey) ?? 0;

			if (currentCount >= maxSlotsPerDayPeriod) {
				continue;
			}

			periodCounts.set(periodKey, currentCount + 1);
		}

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

export function isSlotInPublicBookingGroups(input: {
	slotGroups: PublicBookingSlotDayGroup[];
	startsAt: Date;
	endsAt: Date;
}): boolean {
	const startsAtIso = input.startsAt.toISOString();
	const endsAtIso = input.endsAt.toISOString();

	return input.slotGroups.some((day) =>
		day.slots.some((slot) => slot.startsAtIso === startsAtIso && slot.endsAtIso === endsAtIso)
	);
}

export async function resolvePublicBookingSlots(input: {
	bookingType: BookingType;
	requesterEmail: string;
	now?: Date;
	slotProfile?: PublicBookingSlotProfile;
}): Promise<PublicBookingResolution> {
	const now = input.now ?? new Date();
	const { searchStartsAt, searchEndsAt } = getPublicBookingSearchWindow({
		now,
		bookingType: input.bookingType,
		slotProfile: input.slotProfile
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
		slotGroups: toSlotGroups(availability, input.slotProfile)
	};
}

export async function resolvePublicBookingSlotPreview(input: {
	bookingType: BookingType;
	now?: Date;
	slotProfile?: PublicBookingSlotProfile;
}): Promise<PublicBookingSlotPreview> {
	const now = input.now ?? new Date();
	const { searchStartsAt, searchEndsAt } = getPublicBookingSearchWindow({
		now,
		bookingType: input.bookingType,
		slotProfile: input.slotProfile
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
		slotGroups: toSlotGroups(availability, input.slotProfile)
	};
}
