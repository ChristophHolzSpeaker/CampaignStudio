import { form, getRequestEvent } from '$app/server';
import { resolveCampaignPageContext } from '$lib/server/attribution/campaign-context';
import { normalizeEmailAddress } from '$lib/server/attribution/email';
import { logLeadEvent } from '$lib/server/attribution/lead-events';
import { findOrCreateLeadJourneyFromInquiry } from '$lib/server/attribution/lead-journeys';
import { sendBookingLinkInviteEmailForLeadSubmission } from '$lib/server/bookings/woody-email-service';
import { notifyLeadCreated } from '$lib/server/notifications/lead-notifications';
import { z } from 'zod';

const bookingRequestSchema = z.object({
	fullName: z.string().trim().min(2, 'Please enter your full name.'),
	organization: z.string().trim().min(2, 'Please enter your organization.'),
	email: z.string().trim().email('Please provide a valid email address.'),
	eventDetails: z
		.string()
		.trim()
		.min(20, 'Please provide a bit more detail about your event goals.'),
	campaignId: z.number().int().positive('Missing campaign context.'),
	campaignPageId: z.number().int().positive('Missing page context.'),
	pageSlug: z.string().trim().optional(),
	sessionId: z.string().trim().min(1).max(255).optional(),
	anonymousId: z.string().trim().min(1).max(255).optional()
});

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

export const submitBookingRequest = form('unchecked', async (rawData) => {
	const parsed = bookingRequestSchema.safeParse({
		fullName: readSingleString(rawData.fullName) ?? '',
		organization: readSingleString(rawData.organization) ?? '',
		email: readSingleString(rawData.email) ?? '',
		eventDetails: readSingleString(rawData.eventDetails) ?? '',
		campaignId: Number(readSingleString(rawData.campaignId)),
		campaignPageId: Number(readSingleString(rawData.campaignPageId)),
		pageSlug: readSingleString(rawData.pageSlug),
		sessionId: readSingleString(rawData.sessionId),
		anonymousId: readSingleString(rawData.anonymousId)
	});

	if (!parsed.success) {
		return {
			success: false,
			message: parsed.error.issues[0]?.message ?? 'Unable to submit right now.'
		};
	}

	const data = parsed.data;
	const requestEvent = getRequestEvent();
	const normalizedEmail = normalizeEmailAddress(data.email);
	if (!normalizedEmail) {
		return {
			success: false,
			message: 'Please provide a valid email address.'
		};
	}

	const campaignContext = await resolveCampaignPageContext({
		campaignId: data.campaignId,
		campaignPageId: data.campaignPageId
	});

	if (!campaignContext) {
		return {
			success: false,
			message: 'Unable to submit right now. Please refresh and try again.'
		};
	}

	const now = new Date();
	const { journey, created } = await findOrCreateLeadJourneyFromInquiry({
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId,
		contactEmail: normalizedEmail,
		contactName: data.fullName,
		now
	});

	await logLeadEvent({
		leadJourneyId: journey.id,
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId,
		eventType: 'form_submitted',
		eventSource: 'sveltekit.frictionless_funnel_form',
		eventPayload: {
			attribution: {
				page_path: requestEvent.url.pathname,
				page_slug: data.pageSlug ?? null,
				campaign_page_id: campaignContext.campaignPageId
			},
			form: {
				organization: data.organization,
				meeting_scope: data.eventDetails,
				event_details_length: data.eventDetails.length
			},
			journey: {
				created
			}
		},
		sessionId: data.sessionId,
		anonymousId: data.anonymousId
	});

	if (created) {
		try {
			await notifyLeadCreated({
				created,
				leadJourneyId: journey.id,
				attendeeName: data.fullName,
				attendeeEmail: normalizedEmail,
				company: data.organization,
				meetingScope: data.eventDetails,
				campaignId: campaignContext.campaignId,
				campaignPageId: campaignContext.campaignPageId,
				pageSlug: data.pageSlug,
				pagePath: requestEvent.url.pathname
			});
		} catch (notificationError) {
			console.error('telegram_new_lead_notification_failed', {
				lead_journey_id: journey.id,
				error:
					notificationError instanceof Error
						? notificationError.message
						: 'unknown_notification_error'
			});
		}
	}

	try {
		await sendBookingLinkInviteEmailForLeadSubmission({
			leadJourneyId: journey.id
		});
	} catch (emailError) {
		console.error('woody_booking_link_invite_failed', {
			lead_journey_id: journey.id,
			error: emailError instanceof Error ? emailError.message : 'unknown_email_error'
		});
	}

	return {
		success: true,
		message: 'Thanks! Your booking request is captured. We will follow up shortly.',
		leadJourneyId: journey.id,
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId,
		contactEmail: normalizedEmail,
		next: {
			woody: { shouldTrigger: true },
			booking: { canGenerateLink: true },
			hubspot: { canSync: true }
		}
	};
});
