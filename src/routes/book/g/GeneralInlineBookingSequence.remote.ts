import { form, getRequestEvent } from '$app/server';
import {
	confirmBookingSelection,
	getBookingPolicy,
	getPublicBookingUnavailableMessage,
	resolvePublicBookingSlotPreview
} from '$lib/server/bookings';
import { notifyBookingFormSubmission } from '$lib/server/notifications/booking-form-submission';
import {
	bookingConfirmationSchema,
	getBookingConfirmationSubmission
} from '$lib/validation/booking-intake';

function readSingleString(input: unknown): string | undefined {
	if (typeof input === 'string') {
		return input;
	}
	if (Array.isArray(input)) {
		const first = input[0];
		return typeof first === 'string' ? first : undefined;
	}
	return undefined;
}

export const submitGeneralInlineBooking = form('unchecked', async (rawData) => {
	const requestEvent = getRequestEvent();
	const formData = new FormData();

	for (const [key, value] of Object.entries(rawData)) {
		const singleValue = readSingleString(value) ?? '';
		formData.set(key, singleValue);
	}

	const intake = getBookingConfirmationSubmission(formData);
	const parseResult = bookingConfirmationSchema.safeParse(intake);
	if (!parseResult.success) {
		return {
			success: false,
			message:
				parseResult.error.issues[0]?.message ?? 'Please review your details and selected slot.',
			confirmationState: 'invalid'
		};
	}

	const policy = await getBookingPolicy('general');
	if (policy.state !== 'active') {
		return {
			success: false,
			message: getPublicBookingUnavailableMessage(policy) ?? 'Booking is currently unavailable.',
			confirmationState: 'booking_unavailable'
		};
	}

	try {
		await notifyBookingFormSubmission({
			flow: 'book_g',
			email: parseResult.data.email,
			name: parseResult.data.name ?? null,
			phone: parseResult.data.phone ?? null,
			company: parseResult.data.company ?? null,
			scope: parseResult.data.scope,
			pagePath: '/book/g'
		});
	} catch (error) {
		console.error('booking_form_submission_notification_failed', {
			flow: 'book_g',
			error: error instanceof Error ? error.message : 'unknown_error'
		});
	}

	const confirmation = await confirmBookingSelection({
		bookingType: 'general',
		intake: {
			email: parseResult.data.email,
			scope: parseResult.data.scope,
			name: parseResult.data.name,
			phone: parseResult.data.phone,
			company: parseResult.data.company
		},
		selectedStartsAt: new Date(parseResult.data.selectedStartsAtIso),
		selectedEndsAt: new Date(parseResult.data.selectedEndsAtIso),
		requestOrigin: requestEvent.url.origin
	});

	if (confirmation.state !== 'confirmed') {
		return {
			success: false,
			message: confirmation.message,
			confirmationState: confirmation.state
		};
	}

	const slotPreview = await resolvePublicBookingSlotPreview({ bookingType: 'general' });

	return {
		success: true,
		message: 'Briefing confirmed. Please check your inbox for the calendar invite.',
		confirmationState: 'confirmed',
		confirmedBookingId: confirmation.booking.id,
		slotGroups: slotPreview.slotGroups
	};
});
