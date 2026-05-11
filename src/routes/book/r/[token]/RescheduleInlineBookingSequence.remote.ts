import { form, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { confirmBookingReschedule } from '$lib/server/bookings';

const rescheduleConfirmationSchema = z.object({
	selectedStartsAtIso: z
		.string()
		.trim()
		.min(1, 'Please select a slot')
		.refine((value) => !Number.isNaN(Date.parse(value)), 'Selected slot is invalid'),
	selectedEndsAtIso: z
		.string()
		.trim()
		.min(1, 'Please select a slot')
		.refine((value) => !Number.isNaN(Date.parse(value)), 'Selected slot is invalid')
});

function readSingleString(input: unknown): string {
	if (typeof input === 'string') {
		return input;
	}
	if (Array.isArray(input)) {
		const first = input[0];
		return typeof first === 'string' ? first : '';
	}
	return '';
}

export const submitRescheduleBooking = form('unchecked', async (rawData) => {
	const requestEvent = getRequestEvent();
	const token = requestEvent.params.token?.trim() ?? '';

	const parseResult = rescheduleConfirmationSchema.safeParse({
		selectedStartsAtIso: readSingleString(rawData.selected_starts_at),
		selectedEndsAtIso: readSingleString(rawData.selected_ends_at)
	});

	if (!parseResult.success) {
		return {
			success: false,
			confirmationState: 'invalid',
			message: parseResult.error.issues[0]?.message ?? 'Please select a valid slot.'
		};
	}

	const confirmation = await confirmBookingReschedule({
		rescheduleToken: token,
		selectedStartsAt: new Date(parseResult.data.selectedStartsAtIso),
		selectedEndsAt: new Date(parseResult.data.selectedEndsAtIso),
		requestOrigin: requestEvent.url.origin
	});

	if (confirmation.state === 'rescheduled') {
		return {
			success: true,
			confirmationState: 'rescheduled',
			updatedBookingId: confirmation.booking.id,
			updatedStartsAtIso: confirmation.booking.starts_at.toISOString(),
			updatedEndsAtIso: confirmation.booking.ends_at.toISOString(),
			message: 'Booking rescheduled. Your calendar invite will reflect the new time.'
		};
	}

	return {
		success: false,
		confirmationState: confirmation.state,
		message: confirmation.message
	};
});
