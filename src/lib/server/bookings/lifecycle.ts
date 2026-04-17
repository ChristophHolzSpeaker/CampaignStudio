import type {
	AttachCalendarEventIdInput,
	AttachCalendarEventIdResult,
	CreateBookingInput,
	CreateBookingResult,
	MarkRepeatInteractionInput,
	MarkRepeatInteractionResult,
	RescheduleBookingInput,
	RescheduleBookingResult
} from './contracts';
import {
	createBookingRecord,
	createBookingRescheduleAudit,
	getBookingByRescheduleToken,
	updateBookingGoogleEventId,
	updateBookingRepeatInteraction,
	updateBookingSchedule
} from './repository';

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
	const booking = await createBookingRecord(input);

	return {
		booking
	};
}

export async function rescheduleBooking(
	input: RescheduleBookingInput
): Promise<RescheduleBookingResult> {
	const existingBooking = await getBookingByRescheduleToken(input.rescheduleToken);

	if (!existingBooking) {
		throw new Error('Booking with this reschedule token was not found');
	}

	const booking = await updateBookingSchedule({
		bookingId: existingBooking.id,
		startsAt: input.newStartsAt,
		endsAt: input.newEndsAt
	});

	const audit = await createBookingRescheduleAudit({
		bookingId: existingBooking.id,
		oldStartsAt: existingBooking.starts_at,
		oldEndsAt: existingBooking.ends_at,
		newStartsAt: input.newStartsAt,
		newEndsAt: input.newEndsAt,
		changedBy: input.changedBy
	});

	return {
		booking,
		audit
	};
}

export async function attachBookingCalendarEventId(
	input: AttachCalendarEventIdInput
): Promise<AttachCalendarEventIdResult> {
	const booking = await updateBookingGoogleEventId({
		bookingId: input.bookingId,
		googleCalendarEventId: input.googleCalendarEventId
	});

	return {
		booking
	};
}

export async function markBookingRepeatInteraction(
	input: MarkRepeatInteractionInput
): Promise<MarkRepeatInteractionResult> {
	const booking = await updateBookingRepeatInteraction({
		bookingId: input.bookingId,
		isRepeatInteraction: input.isRepeatInteraction
	});

	return {
		booking
	};
}
