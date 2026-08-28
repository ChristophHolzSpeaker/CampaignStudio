import { form, getRequestEvent } from '$app/server';
import {
	confirmBookingSelection,
	getBookingPolicy,
	resolveLeadBookingToken
} from '$lib/server/bookings';
import { readVisitorIdentifier } from '$lib/server/attribution/campaign-visits';
import { getLeadJourneyById } from '$lib/server/attribution/lead-journeys';
import { logLeadEvent } from '$lib/server/attribution/lead-events';
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
		return 'Dieser Link für das Briefing ist abgelaufen. Bitte fordern Sie einen neuen Link an.';
	}

	return 'Dieser Link für das Briefing ist ungültig.';
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
			message: 'Das Briefing ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.'
		};
	}

	const parseResult = bookingConfirmationSchema.safeParse(confirmationValues);
	if (!parseResult.success) {
		return {
			success: false,
			confirmationState: 'invalid',
			message: 'Bitte überprüfen Sie Ihre Angaben und den ausgewählten Termin.'
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
		try {
			const leadJourneyId = tokenResolution.context.leadJourneyId;
			if (leadJourneyId) {
				const journey = await getLeadJourneyById(leadJourneyId);
				await logLeadEvent({
					leadJourneyId,
					campaignVisitId: journey?.last_visit_id ?? journey?.first_visit_id ?? null,
					campaignId: tokenResolution.context.campaignId,
					campaignPageId: journey?.last_page_id ?? journey?.first_page_id ?? null,
					eventType: 'booking_completed',
					eventSource: 'sveltekit.book_lead_page',
					anonymousId: readVisitorIdentifier(requestEvent.cookies),
					eventPayload: {
						booking_id: confirmation.booking.id,
						booking_link_id: tokenResolution.context.bookingLinkId,
						booking_type: 'lead',
						starts_at: confirmation.booking.starts_at.toISOString(),
						ends_at: confirmation.booking.ends_at.toISOString()
					}
				});
			}
		} catch (error) {
			console.error('booking_completed_attribution_failed', {
				bookingId: confirmation.booking.id,
				error: error instanceof Error ? error.message : 'unknown_error'
			});
		}

		return {
			success: true,
			confirmationState: 'confirmed',
			confirmedBookingId: confirmation.booking.id,
			message:
				'Briefing bestätigt. Woody, Christophs KI-Assistent, schreibt Ihnen in Kürze per E-Mail. Bitte prüfen Sie Ihren Posteingang auf die Kalendereinladung.'
		};
	}

	return {
		success: false,
		confirmationState: confirmation.state,
		message:
			'Der ausgewählte Termin ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen Termin.'
	};
});
