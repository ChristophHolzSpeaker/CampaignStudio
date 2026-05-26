import { form, getRequestEvent } from '$app/server';
import { readVisitorIdentifier } from '$lib/server/attribution/campaign-visits';
import { resolveCampaignPageContext } from '$lib/server/attribution/campaign-context';
import { normalizeEmailAddress } from '$lib/server/attribution/email';
import { logLeadEvent } from '$lib/server/attribution/lead-events';
import { findOrCreateLeadJourneyFromInquiry } from '$lib/server/attribution/lead-journeys';
import { persistJourneyAttributionSnapshot } from '$lib/server/attribution/journey-attribution';
import { notifyBookingFormSubmission } from '$lib/server/notifications/booking-form-submission';
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

function resolveInlineLeadAttributionSurface(bookingSurface: string | null): {
	eventSource: string;
	notificationFlow: 'inline_lead_sequence' | 'inline_lead_sequence_hero';
	formType: 'inline_booking_sequence' | 'hero_inline_booking_sequence';
} {
	if (bookingSurface === 'hero') {
		return {
			eventSource: 'sveltekit.hero_inline_lead_booking_sequence',
			notificationFlow: 'inline_lead_sequence_hero',
			formType: 'hero_inline_booking_sequence'
		};
	}

	if (bookingSurface === 'frictionless_funnel') {
		return {
			eventSource: 'sveltekit.frictionless_funnel_inline_lead_booking_sequence',
			notificationFlow: 'inline_lead_sequence',
			formType: 'inline_booking_sequence'
		};
	}

	return {
		eventSource: 'sveltekit.inline_lead_booking_sequence',
		notificationFlow: 'inline_lead_sequence',
		formType: 'inline_booking_sequence'
	};
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
	const bookingSurface = readSingleString(rawData.bookingSurface) ?? null;
	const ctaKey = readSingleString(rawData.ctaKey) ?? null;
	const ctaSection = readSingleString(rawData.ctaSection) ?? null;
	const ctaVariant = readSingleString(rawData.ctaVariant) ?? null;
	const attributionSurface = resolveInlineLeadAttributionSurface(bookingSurface);
	const intake = getBookingConfirmationSubmission(formData);

	const parseResult = bookingConfirmationSchema.safeParse(intake);
	if (!parseResult.success) {
		return {
			success: false,
			message:
				parseResult.error.issues[0]?.message ??
				'Bitte pruefen Sie Ihre Angaben und den ausgewaehlten Termin.',
			confirmationState: 'invalid'
		};
	}

	if (!Number.isInteger(campaignId) || campaignId <= 0) {
		return {
			success: false,
			message:
				'Fehlender Kampagnenkontext. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
			confirmationState: 'booking_unavailable'
		};
	}

	if (!Number.isInteger(campaignPageId) || campaignPageId <= 0) {
		return {
			success: false,
			message:
				'Fehlender Seitenkontext. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
			confirmationState: 'booking_unavailable'
		};
	}

	try {
		await notifyBookingFormSubmission({
			flow: attributionSurface.notificationFlow,
			email: parseResult.data.email,
			name: parseResult.data.name ?? null,
			phone: parseResult.data.phone ?? null,
			company: parseResult.data.company ?? null,
			scope: parseResult.data.scope,
			campaignId,
			campaignPageId,
			pageSlug,
			pagePath: requestEvent.url.pathname
		});
	} catch (error) {
		console.error('booking_form_submission_notification_failed', {
			flow: attributionSurface.notificationFlow,
			error: error instanceof Error ? error.message : 'unknown_error'
		});
	}

	const policy = await getBookingPolicy('lead');
	if (policy.state !== 'active') {
		return {
			success: false,
			message:
				getPublicBookingUnavailableMessage(policy) ?? 'Die Buchung ist aktuell nicht verfuegbar.',
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
				'Wir konnten Ihre Anfrage derzeit nicht verifizieren. Bitte versuchen Sie es in Kuerze erneut oder schreiben Sie uns direkt per E-Mail.',
			confirmationState: 'qualification_failed'
		};
	}

	if (!isLeadBookingIntentApproved(intentDecision)) {
		return {
			success: false,
			message:
				'Vielen Dank fuer Ihre Anfrage. Dieser Buchungsweg ist ausschliesslich fuer Anfragen zu Speaking-Engagements vorgesehen.',
			confirmationState: 'qualification_failed',
			qualification: intentDecision
		};
	}

	const normalizedEmail = normalizeEmailAddress(parseResult.data.email);
	if (!normalizedEmail) {
		return {
			success: false,
			message: 'Bitte geben Sie eine gueltige E-Mail-Adresse an.',
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
			message:
				'Die Buchung kann derzeit nicht bestaetigt werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
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
		eventSource: attributionSurface.eventSource,
		metadata: {
			intake: {
				email: normalizedEmail,
				scope: parseResult.data.scope,
				name: parseResult.data.name ?? null,
				phone: parseResult.data.phone ?? null,
				company: parseResult.data.company ?? null
			},
			intent: intentDecision,
			attribution: {
				booking_surface: bookingSurface,
				cta_key: ctaKey,
				cta_section: ctaSection,
				cta_variant: ctaVariant
			}
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
		eventSource: attributionSurface.eventSource,
		cta: {
			key: ctaKey,
			section: ctaSection,
			variant: ctaVariant
		},
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
				form_type: attributionSurface.formType
			},
			journey: {
				created
			},
			qualification: intentDecision,
			booking_surface: bookingSurface,
			booking_confirmation_state: confirmation.state
		}
	});

	await persistJourneyAttributionSnapshot({
		journeyId: journey.id,
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId,
		visitorIdentifier,
		observedAt: now
	});

	if (confirmation.state !== 'confirmed') {
		return {
			success: false,
			message:
				'Die Buchung konnte nicht bestaetigt werden. Bitte versuchen Sie es erneut oder kontaktieren Sie uns direkt.',
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
			'Briefing bestaetigt. Woody, Christophs KI-Assistenz, schreibt Ihnen in Kuerze per E-Mail. Bitte pruefen Sie Ihren Posteingang auf die Kalendereinladung.',
		confirmationState: 'confirmed',
		confirmedBookingId: confirmation.booking.id,
		slotGroups: bookingFlow.slotGroups
	};
});
