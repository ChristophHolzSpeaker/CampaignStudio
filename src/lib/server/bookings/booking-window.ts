import { env } from '$env/dynamic/private';

const DEFAULT_BOOKING_TIMEZONE = 'Europe/Berlin';
const DEFAULT_BOOKING_WINDOW_START_MINUTES = 7 * 60;
const DEFAULT_BOOKING_WINDOW_END_MINUTES = 21 * 60;

type LocalClockParts = {
	minutesSinceMidnight: number;
	dateKey: string;
};

function parseEnvInteger(input: string | undefined): number | null {
	if (!input) {
		return null;
	}

	const parsed = Number.parseInt(input, 10);
	if (!Number.isInteger(parsed)) {
		return null;
	}

	return parsed;
}

function normalizeMinutes(input: number, fallback: number): number {
	if (!Number.isInteger(input)) {
		return fallback;
	}

	if (input < 0 || input > 24 * 60) {
		return fallback;
	}

	return input;
}

function getLocalClockParts(date: Date, timeZone: string): LocalClockParts {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	}).formatToParts(date);

	const year = Number(parts.find((part) => part.type === 'year')?.value ?? '0');
	const month = Number(parts.find((part) => part.type === 'month')?.value ?? '0');
	const day = Number(parts.find((part) => part.type === 'day')?.value ?? '0');
	const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
	const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

	return {
		minutesSinceMidnight: hour * 60 + minute,
		dateKey: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
	};
}

export function getBookingWindowConfig(): {
	timeZone: string;
	windowStartMinutes: number;
	windowEndMinutes: number;
} {
	const startFromEnv = parseEnvInteger(env.BOOKING_WINDOW_START_MINUTES);
	const endFromEnv = parseEnvInteger(env.BOOKING_WINDOW_END_MINUTES);

	const timeZone = env.BOOKING_TIMEZONE?.trim() || DEFAULT_BOOKING_TIMEZONE;

	return {
		timeZone,
		windowStartMinutes: normalizeMinutes(
			startFromEnv ?? DEFAULT_BOOKING_WINDOW_START_MINUTES,
			DEFAULT_BOOKING_WINDOW_START_MINUTES
		),
		windowEndMinutes: normalizeMinutes(
			endFromEnv ?? DEFAULT_BOOKING_WINDOW_END_MINUTES,
			DEFAULT_BOOKING_WINDOW_END_MINUTES
		)
	};
}

export function isSlotInsideBookingWindow(input: {
	startsAt: Date;
	endsAt: Date;
	timeZone?: string;
	windowStartMinutes?: number;
	windowEndMinutes?: number;
}): boolean {
	const config = getBookingWindowConfig();
	const timeZone = input.timeZone ?? config.timeZone;
	const windowStartMinutes = input.windowStartMinutes ?? config.windowStartMinutes;
	const windowEndMinutes = input.windowEndMinutes ?? config.windowEndMinutes;

	const startsAt = getLocalClockParts(input.startsAt, timeZone);
	const endsAt = getLocalClockParts(input.endsAt, timeZone);

	if (windowStartMinutes === windowEndMinutes) {
		return true;
	}

	if (windowStartMinutes < windowEndMinutes) {
		return (
			startsAt.dateKey === endsAt.dateKey &&
			startsAt.minutesSinceMidnight >= windowStartMinutes &&
			endsAt.minutesSinceMidnight <= windowEndMinutes
		);
	}

	const isInWrappedWindow = (minutesSinceMidnight: number): boolean => {
		return minutesSinceMidnight >= windowStartMinutes || minutesSinceMidnight <= windowEndMinutes;
	};

	return (
		isInWrappedWindow(startsAt.minutesSinceMidnight) &&
		isInWrappedWindow(endsAt.minutesSinceMidnight)
	);
}
