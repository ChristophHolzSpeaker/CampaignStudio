import { form, getRequestEvent } from '$app/server';
import {
	confirmBookingSelection,
	getBookingPolicy,
	getPublicBookingUnavailableMessage,
	resolveLeadBookingToken
} from '$lib/server/bookings';
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

function getTokenMessage(state: 'invalid' | 'expired'): string {
	if (state === 'expired') {
		return 'This briefing link has expired. Please request a new link.';
	}

	return 'This briefing link is invalid.';
}

export const submitLeadTokenBooking = form('unchecked', async (rawData) => {
	const requestEvent = getRequestEvent();
	const token = requestEvent.params.token?.trim() ?? '';
	const tokenResolution = await resolveLeadBookingToken(token);

	const formData = new FormData();
	for (const [key, value] of Object.entries(rawData)) {
		formData.set(key, readSingleString(value) ?? '');
	}

	const confirmationValues = getBookingConfirmationSubmission(formData);

	if (tokenResolution.state !== 'usable') {
		return {
			success: false,
			confirmationState: 'booking_unavailable',
			message: getTokenMessage(tokenResolution.state)
		};
	}

	const policy = await getBookingPolicy('lead');
	if (policy.state !== 'active') {
		return {
			success: false,
			confirmationState: 'booking_unavailable',
			message: getPublicBookingUnavailableMessage(policy) ?? 'Briefing is currently unavailable.'
		};
	}

	const parseResult = bookingConfirmationSchema.safeParse(confirmationValues);
	if (!parseResult.success) {
		return {
			success: false,
			confirmationState: 'invalid',
			message:
				parseResult.error.issues[0]?.message ?? 'Please review your details and selected slot.'
		};
	}

	const confirmation = await confirmBookingSelection({
		bookingType: 'lead',
		intake: {
			email: parseResult.data.email,
			scope: parseResult.data.scope,
			name: parseResult.data.name,
			phone: parseResult.data.phone,
			company: parseResult.data.company
		},
		selectedStartsAt: new Date(parseResult.data.selectedStartsAtIso),
		selectedEndsAt: new Date(parseResult.data.selectedEndsAtIso),
		requestOrigin: requestEvent.url.origin,
		leadTokenContext: {
			token: tokenResolution.context.token,
			bookingLinkId: tokenResolution.context.bookingLinkId,
			leadJourneyId: tokenResolution.context.leadJourneyId,
			campaignId: tokenResolution.context.campaignId,
			metadata: tokenResolution.context.metadata
		}
	});

	if (confirmation.state === 'confirmed') {
		return {
			success: true,
			confirmationState: 'confirmed',
			confirmedBookingId: confirmation.booking.id,
			message:
				"Briefing confirmed. Woody, Christoph's AI assistant will email you shortly. Please check your inbox for the calendar invite."
		};
	}

	return {
		success: false,
		confirmationState: confirmation.state,
		message: confirmation.message
	};
});
