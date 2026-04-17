import { normalizeEmailAddress } from '$lib/server/attribution/email';
import type {
	BookingRecord,
	BookingRequesterClassification,
	RequesterRecentBookingSummary
} from './contracts';
import { getBookingsByEmail, getUpcomingConfirmedBookingByEmail } from './repository';

function toBookingSummary(booking: BookingRecord): RequesterRecentBookingSummary {
	return {
		bookingId: booking.id,
		status: booking.status,
		startsAt: booking.starts_at,
		endsAt: booking.ends_at,
		bookingType: booking.booking_type,
		isRepeatInteraction: booking.is_repeat_interaction
	};
}

export async function classifyBookingRequesterByEmail(
	email: string,
	input?: { now?: Date }
): Promise<BookingRequesterClassification> {
	const normalizedEmail = normalizeEmailAddress(email);

	if (!normalizedEmail) {
		throw new Error('Invalid email address for booking requester classification');
	}

	const now = input?.now ?? new Date();
	const [allBookings, upcomingBooking] = await Promise.all([
		getBookingsByEmail(normalizedEmail, { limit: 200 }),
		getUpcomingConfirmedBookingByEmail(normalizedEmail, { now })
	]);

	const hasPriorBookings = allBookings.length > 0;
	const recentBooking = allBookings[0] ?? null;

	return {
		email,
		normalizedEmail,
		hasPriorBookings,
		hasUpcomingBooking: upcomingBooking !== null,
		interactionKind: hasPriorBookings ? 'repeat' : 'first_time',
		upcomingBooking: upcomingBooking ? toBookingSummary(upcomingBooking) : null,
		recentBooking: recentBooking ? toBookingSummary(recentBooking) : null,
		totalBookings: allBookings.length
	};
}
