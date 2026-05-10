import { form, getRequestEvent } from '$app/server';
import { readVisitorIdentifier } from '$lib/server/attribution/campaign-visits';
import { resolveCampaignPageContext } from '$lib/server/attribution/campaign-context';
import { normalizeEmailAddress } from '$lib/server/attribution/email';
import { logLeadEvent } from '$lib/server/attribution/lead-events';
import { findOrCreateLeadJourneyFromInquiry } from '$lib/server/attribution/lead-journeys';
import {
	classifyLeadBookingIntent,
	confirmBookingSelection,
	createBookingLinkForJourney,
	getBookingPolicy,
	getPublicBookingUnavailableMessage,
	isLeadBookingIntentApproved,
	resolvePublicBookingSlots
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

export const submitInlineLeadBooking = form('unchecked', async (rawData) => {
	const requestEvent = getRequestEvent();
	const formData = new FormData();

	for (const [key, value] of Object.entries(rawData)) {
		const singleValue = readSingleString(value) ?? '';
		formData.set(key, singleValue);
	}

	const campaignId = Number(readSingleString(rawData.campaignId));
	const campaignPageId = Number(readSingleString(rawData.campaignPageId));
	const pageSlug = readSingleString(rawData.pageSlug) ?? null;
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

	if (!Number.isInteger(campaignId) || campaignId <= 0) {
		return {
			success: false,
			message: 'Missing campaign context. Please refresh and try again.',
			confirmationState: 'booking_unavailable'
		};
	}

	if (!Number.isInteger(campaignPageId) || campaignPageId <= 0) {
		return {
			success: false,
			message: 'Missing page context. Please refresh and try again.',
			confirmationState: 'booking_unavailable'
		};
	}

	const policy = await getBookingPolicy('lead');
	if (policy.state !== 'active') {
		return {
			success: false,
			message: getPublicBookingUnavailableMessage(policy) ?? 'Booking is currently unavailable.',
			confirmationState: 'booking_unavailable'
		};
	}

	let intentDecision;
	try {
		intentDecision = await classifyLeadBookingIntent({
			scope: parseResult.data.scope,
			company: parseResult.data.company,
			name: parseResult.data.name
		});
	} catch {
		return {
			success: false,
			message:
				'We could not verify your request intent right now. Please try again shortly or email us directly.',
			confirmationState: 'qualification_failed'
		};
	}

	if (!isLeadBookingIntentApproved(intentDecision)) {
		return {
			success: false,
			message:
				'Thanks for your request. This booking path is reserved for speaking engagement inquiries only.',
			confirmationState: 'qualification_failed',
			qualification: intentDecision
		};
	}

	const normalizedEmail = normalizeEmailAddress(parseResult.data.email);
	if (!normalizedEmail) {
		return {
			success: false,
			message: 'Please provide a valid email address.',
			confirmationState: 'invalid'
		};
	}

	const campaignContext = await resolveCampaignPageContext({
		campaignId,
		campaignPageId
	});

	if (!campaignContext) {
		return {
			success: false,
			message: 'Unable to confirm booking right now. Please refresh and try again.',
			confirmationState: 'booking_unavailable'
		};
	}

	const visitorIdentifier = readVisitorIdentifier(requestEvent.cookies);
	const now = new Date();
	const { journey, created } = await findOrCreateLeadJourneyFromInquiry({
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId,
		contactEmail: normalizedEmail,
		contactName: parseResult.data.name ?? '',
		visitorIdentifier,
		now
	});

	const bookingLink = await createBookingLinkForJourney({
		leadJourneyId: journey.id,
		campaignId: campaignContext.campaignId,
		eventSource: 'sveltekit.inline_lead_booking_sequence',
		metadata: {
			intake: {
				email: normalizedEmail,
				scope: parseResult.data.scope,
				name: parseResult.data.name ?? null,
				phone: parseResult.data.phone ?? null,
				company: parseResult.data.company ?? null
			},
			intent: intentDecision
		}
	});

	const confirmation = await confirmBookingSelection({
		bookingType: 'lead',
		intake: {
			email: normalizedEmail,
			scope: parseResult.data.scope,
			name: parseResult.data.name,
			phone: parseResult.data.phone,
			company: parseResult.data.company
		},
		selectedStartsAt: new Date(parseResult.data.selectedStartsAtIso),
		selectedEndsAt: new Date(parseResult.data.selectedEndsAtIso),
		requestOrigin: requestEvent.url.origin,
		leadTokenContext: {
			token: bookingLink.token,
			bookingLinkId: bookingLink.bookingLinkId,
			leadJourneyId: journey.id,
			campaignId: campaignContext.campaignId,
			metadata: null
		}
	});

	await logLeadEvent({
		leadJourneyId: journey.id,
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId,
		eventType: 'form_submitted',
		eventSource: 'sveltekit.inline_lead_booking_sequence',
		eventPayload: {
			attribution: {
				page_path: requestEvent.url.pathname,
				page_slug: pageSlug,
				campaign_page_id: campaignContext.campaignPageId
			},
			form: {
				email: normalizedEmail,
				full_name: parseResult.data.name ?? '',
				phone: parseResult.data.phone ?? '',
				organization: parseResult.data.company ?? '',
				meeting_scope: parseResult.data.scope,
				form_type: 'inline_booking_sequence'
			},
			journey: {
				created
			},
			qualification: intentDecision,
			booking_confirmation_state: confirmation.state
		}
	});

	if (confirmation.state !== 'confirmed') {
		return {
			success: false,
			message: confirmation.message,
			confirmationState: confirmation.state
		};
	}

	const bookingFlow = await resolvePublicBookingSlots({
		bookingType: 'lead',
		requesterEmail: normalizedEmail
	});

	return {
		success: true,
		message:
			"Briefing confirmed. Woody, Christoph's AI assistant will email you shortly. Please check your inbox for the calendar invite.",
		confirmationState: 'confirmed',
		confirmedBookingId: confirmation.booking.id,
		slotGroups: bookingFlow.slotGroups
	};
});
