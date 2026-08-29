import { normalizeEmailAddress } from '$lib/server/attribution/email';
import { logLeadEvent } from '$lib/server/attribution/lead-events';
import { findOrCreateLeadJourneyFromInquiry } from '$lib/server/attribution/lead-journeys';
import { resolveCampaignVisitId } from '$lib/server/attribution/campaign-visits';
import { classifyLeadBookingIntent, isLeadBookingIntentApproved } from '$lib/server/bookings';
import { sendBookingLinkInviteEmailForLeadSubmission } from '$lib/server/bookings/woody-email-service';
import { notifyBookingFormSubmission } from '$lib/server/notifications/booking-form-submission';

type NotificationFlow = Parameters<typeof notifyBookingFormSubmission>[0]['flow'];

export type LeadIntakeServiceInput = {
	intake: { email: string; scope: string; name?: string; phone?: string; company?: string };
	campaignId: number;
	campaignPageId: number | null;
	visitorIdentifier: string | null;
	pageSlug: string | null;
	pagePath: string;
	surface: string;
	eventSource: string;
	formType: string;
	notificationFlow: NotificationFlow;
	cta?: { key?: string | null; section?: string | null; variant?: string | null };
	logJourneyCreated?: boolean;
};

export async function submitLeadIntake(
	input: LeadIntakeServiceInput
): Promise<{ journeyId: string; intentApproved: boolean }> {
	const intake = {
		...input.intake,
		name: input.intake.name ?? '',
		phone: input.intake.phone ?? '',
		company: input.intake.company ?? ''
	};
	try {
		await notifyBookingFormSubmission({
			flow: input.notificationFlow,
			email: intake.email,
			name: intake.name || null,
			phone: intake.phone || null,
			company: intake.company || null,
			scope: intake.scope,
			campaignId: input.campaignId,
			campaignPageId: input.campaignPageId,
			pageSlug: input.pageSlug,
			pagePath: input.pagePath
		});
	} catch (error) {
		console.error('lead_intake_notification_failed', {
			surface: input.surface,
			error: error instanceof Error ? error.message : 'unknown_error'
		});
	}
	const normalizedEmail = normalizeEmailAddress(intake.email);
	if (!normalizedEmail) throw new Error('Please provide a valid email address.');
	let intentDecision: Awaited<ReturnType<typeof classifyLeadBookingIntent>> | null = null;
	try {
		intentDecision = await classifyLeadBookingIntent({
			scope: intake.scope,
			company: intake.company,
			name: intake.name
		});
	} catch (error) {
		console.error('lead_intake_intent_classification_failed', {
			surface: input.surface,
			error: error instanceof Error ? error.message : 'unknown_error'
		});
	}
	const intentApproved = intentDecision ? isLeadBookingIntentApproved(intentDecision) : false;
	const now = new Date();
	const campaignVisitId = input.campaignPageId
		? await resolveCampaignVisitId({
				campaignId: input.campaignId,
				campaignPageId: input.campaignPageId,
				visitorIdentifier: input.visitorIdentifier,
				observedAt: now
			})
		: null;
	const { journey, created } = await findOrCreateLeadJourneyFromInquiry({
		campaignId: input.campaignId,
		campaignPageId: input.campaignPageId,
		contactEmail: normalizedEmail,
		contactName: intake.name,
		visitorIdentifier: input.visitorIdentifier,
		now
	});
	if (created && input.logJourneyCreated)
		await logLeadEvent({
			leadJourneyId: journey.id,
			campaignVisitId,
			campaignId: input.campaignId,
			campaignPageId: input.campaignPageId,
			eventType: 'journey_created',
			eventSource: input.eventSource,
			anonymousId: input.visitorIdentifier,
			eventPayload: { creation_source: 'form_submission', booking_surface: input.surface }
		});
	await logLeadEvent({
		leadJourneyId: journey.id,
		campaignVisitId,
		campaignId: input.campaignId,
		campaignPageId: input.campaignPageId,
		eventType: 'form_submitted',
		eventSource: input.eventSource,
		anonymousId: input.visitorIdentifier,
		cta: input.cta,
		eventPayload: {
			attribution: {
				page_path: input.pagePath,
				page_slug: input.pageSlug,
				campaign_page_id: input.campaignPageId
			},
			form: {
				email: normalizedEmail,
				full_name: intake.name,
				phone: intake.phone,
				organization: intake.company,
				meeting_scope: intake.scope,
				form_type: input.formType
			},
			journey: { created },
			qualification: intentDecision,
			intent_approved: intentApproved,
			booking_surface: input.surface
		}
	});
	await logLeadEvent({
		leadJourneyId: journey.id,
		campaignVisitId,
		campaignId: input.campaignId,
		campaignPageId: input.campaignPageId,
		eventType: 'lead_identified',
		eventSource: input.eventSource,
		anonymousId: input.visitorIdentifier,
		eventPayload: {
			identification_method: 'form_submission',
			contact_email: normalizedEmail,
			contact_name: intake.name
		}
	});
	if (intentApproved) {
		try {
			await sendBookingLinkInviteEmailForLeadSubmission({ leadJourneyId: journey.id });
		} catch (error) {
			console.error('lead_intake_booking_link_invite_failed', {
				journeyId: journey.id,
				error: error instanceof Error ? error.message : 'unknown_error'
			});
		}
	}
	return { journeyId: journey.id, intentApproved };
}
