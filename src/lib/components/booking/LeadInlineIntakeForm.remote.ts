import { form, getRequestEvent } from '$app/server';
import {
	readVisitorIdentifier,
	resolveCampaignVisitId
} from '$lib/server/attribution/campaign-visits';
import { resolveCampaignPageContext } from '$lib/server/attribution/campaign-context';
import { normalizeEmailAddress } from '$lib/server/attribution/email';
import { logLeadEvent } from '$lib/server/attribution/lead-events';
import { findOrCreateLeadJourneyFromInquiry } from '$lib/server/attribution/lead-journeys';
import { notifyBookingFormSubmission } from '$lib/server/notifications/booking-form-submission';
import { classifyLeadBookingIntent, isLeadBookingIntentApproved } from '$lib/server/bookings';
import { sendBookingLinkInviteEmailForLeadSubmission } from '$lib/server/bookings/woody-email-service';
import { bookingIntakeSchema, getBookingIntakeSubmission } from '$lib/validation/booking-intake';

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

export const submitInlineLeadIntake = form('unchecked', async (rawData) => {
	const requestEvent = getRequestEvent();
	const formData = new FormData();

	for (const [key, value] of Object.entries(rawData)) {
		formData.set(key, readSingleString(value) ?? '');
	}

	const parseResult = bookingIntakeSchema.safeParse(getBookingIntakeSubmission(formData));
	if (!parseResult.success) {
		return {
			success: false,
			message: parseResult.error.issues[0]?.message ?? 'Bitte pruefen Sie Ihre Angaben.'
		};
	}

	const campaignId = Number(readSingleString(rawData.campaignId));
	const campaignPageId = Number(readSingleString(rawData.campaignPageId));
	const pageSlug = readSingleString(rawData.pageSlug) ?? null;
	const bookingSurface = readSingleString(rawData.bookingSurface) ?? 'inline_intake';
	const ctaKey = readSingleString(rawData.ctaKey) ?? null;
	const ctaSection = readSingleString(rawData.ctaSection) ?? null;
	const ctaVariant = readSingleString(rawData.ctaVariant) ?? null;

	if (!Number.isInteger(campaignId) || campaignId <= 0) {
		return {
			success: false,
			message:
				'Fehlender Kampagnenkontext. Bitte laden Sie die Seite neu und versuchen Sie es erneut.'
		};
	}

	if (!Number.isInteger(campaignPageId) || campaignPageId <= 0) {
		return {
			success: false,
			message: 'Fehlender Seitenkontext. Bitte laden Sie die Seite neu und versuchen Sie es erneut.'
		};
	}

	const campaignContext = await resolveCampaignPageContext({ campaignId, campaignPageId });
	if (!campaignContext) {
		return {
			success: false,
			message:
				'Die Anfrage kann derzeit nicht verarbeitet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.'
		};
	}

	try {
		await notifyBookingFormSubmission({
			flow: 'inline_lead_intake',
			email: parseResult.data.email,
			name: parseResult.data.name ?? null,
			phone: parseResult.data.phone ?? null,
			company: parseResult.data.company ?? null,
			scope: parseResult.data.scope,
			campaignId: campaignContext.campaignId,
			campaignPageId: campaignContext.campaignPageId,
			pageSlug,
			pagePath: requestEvent.url.pathname
		});
	} catch (error) {
		console.error('inline_lead_intake_notification_failed', {
			error: error instanceof Error ? error.message : 'unknown_error'
		});
	}

	const normalizedEmail = normalizeEmailAddress(parseResult.data.email);
	if (!normalizedEmail) {
		return {
			success: false,
			message: 'Bitte geben Sie eine gueltige E-Mail-Adresse an.'
		};
	}

	let intentDecision: Awaited<ReturnType<typeof classifyLeadBookingIntent>> | null = null;
	try {
		intentDecision = await classifyLeadBookingIntent({
			scope: parseResult.data.scope,
			company: parseResult.data.company,
			name: parseResult.data.name
		});
	} catch (error) {
		console.error('inline_lead_intake_intent_classification_failed', {
			error: error instanceof Error ? error.message : 'unknown_error'
		});
	}

	const intentApproved = intentDecision ? isLeadBookingIntentApproved(intentDecision) : false;
	const visitorIdentifier = readVisitorIdentifier(requestEvent.cookies);
	const now = new Date();
	const campaignVisitId = await resolveCampaignVisitId({
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId,
		visitorIdentifier,
		observedAt: now
	});
	const { journey, created } = await findOrCreateLeadJourneyFromInquiry({
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId,
		contactEmail: normalizedEmail,
		contactName: parseResult.data.name ?? '',
		visitorIdentifier,
		now
	});

	if (created) {
		await logLeadEvent({
			leadJourneyId: journey.id,
			campaignVisitId,
			campaignId: campaignContext.campaignId,
			campaignPageId: campaignContext.campaignPageId,
			eventType: 'journey_created',
			eventSource: 'sveltekit.inline_lead_intake',
			anonymousId: visitorIdentifier,
			eventPayload: {
				creation_source: 'form_submission',
				booking_surface: bookingSurface
			}
		});
	}

	await logLeadEvent({
		leadJourneyId: journey.id,
		campaignVisitId,
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId,
		eventType: 'form_submitted',
		eventSource: 'sveltekit.inline_lead_intake',
		anonymousId: visitorIdentifier,
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
				form_type: 'inline_lead_intake'
			},
			journey: {
				created
			},
			qualification: intentDecision,
			intent_approved: intentApproved,
			booking_surface: bookingSurface
		}
	});

	if (intentApproved) {
		try {
			await sendBookingLinkInviteEmailForLeadSubmission({ leadJourneyId: journey.id });
		} catch (error) {
			console.error('inline_lead_intake_booking_link_invite_failed', {
				leadJourneyId: journey.id,
				error: error instanceof Error ? error.message : 'unknown_error'
			});
		}
	}

	return {
		success: true,
		message:
			'Vielen Dank fuer Ihre Anfrage. Woody prueft Ihre Angaben und meldet sich per E-Mail mit dem naechsten Schritt. Wenn Ihre Anfrage passt, erhalten Sie einen Link zur Terminbuchung.'
	};
});
