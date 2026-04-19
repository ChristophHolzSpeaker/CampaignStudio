import { createBookingLink } from '$lib/server/attribution/client';
import { getLatestFormSubmissionEventForJourney } from '$lib/server/attribution/lead-events';
import {
	getLeadJourneyById,
	markLeadJourneyBookingLinkInviteEmailSent
} from '$lib/server/attribution/lead-journeys';
import { getBookingById, markBookingConfirmationEmailSent } from '$lib/server/bookings/repository';
import {
	sendBookingConfirmedWoodyEmail,
	sendBookingLinkInviteWoodyEmail
} from '$lib/server/notifications/woody-email';
import type {
	BookingConfirmedEmailContext,
	BookingLinkInviteEmailContext,
	BookingType
} from './contracts';

type BookingLinkInviteWorkflowResult =
	| { status: 'sent'; providerMessageId: string }
	| { status: 'skipped'; reason: string };

type BookingConfirmedWorkflowResult =
	| { status: 'sent'; providerMessageId: string }
	| { status: 'skipped'; reason: string };

function readStringRecordValue(record: Record<string, unknown>, key: string): string | null {
	const value = record[key];
	if (typeof value !== 'string') {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function readNestedRecord(
	record: Record<string, unknown>,
	key: string
): Record<string, unknown> | null {
	const value = record[key];
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}

	return value as Record<string, unknown>;
}

function formatDateTimeRange(input: { startsAt: Date; endsAt: Date }): string {
	const formatter = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'full',
		timeStyle: 'short',
		timeZone: 'UTC'
	});

	return `${formatter.format(input.startsAt)} to ${formatter.format(input.endsAt)} (UTC)`;
}

export async function buildBookingLinkInviteEmailContext(input: {
	leadJourneyId: string;
	bookingLinkUrl: string;
	bookingLinkToken: string;
}): Promise<BookingLinkInviteEmailContext | null> {
	const [journey, latestFormSubmission] = await Promise.all([
		getLeadJourneyById(input.leadJourneyId),
		getLatestFormSubmissionEventForJourney(input.leadJourneyId)
	]);

	if (!journey?.contact_email) {
		return null;
	}

	const eventPayload = latestFormSubmission?.eventPayload ?? {};
	const formPayload = readNestedRecord(eventPayload, 'form') ?? {};
	const attributionPayload = readNestedRecord(eventPayload, 'attribution') ?? {};

	const organization = readStringRecordValue(formPayload, 'organization');
	const meetingScope = readStringRecordValue(formPayload, 'meeting_scope');
	const pagePath = readStringRecordValue(attributionPayload, 'page_path');
	const pageSlug = readStringRecordValue(attributionPayload, 'page_slug');

	return {
		intent: 'booking_link_invite',
		recipientEmail: journey.contact_email,
		recipientName: journey.contact_name,
		leadJourneyId: journey.id,
		campaignId: journey.campaign_id,
		campaignPageId: latestFormSubmission?.campaignId ?? journey.campaign_page_id,
		bookingType: 'lead',
		meetingScope,
		requestSummary: meetingScope,
		organization,
		bookingLinkUrl: input.bookingLinkUrl,
		bookingLinkToken: input.bookingLinkToken,
		pagePath,
		pageSlug
	};
}

export async function buildBookingConfirmedEmailContext(input: {
	bookingId: string;
	calendarEventUrl: string;
}): Promise<BookingConfirmedEmailContext | null> {
	const booking = await getBookingById(input.bookingId);
	if (!booking) {
		return null;
	}

	const journey = booking.lead_journey_id
		? await getLeadJourneyById(booking.lead_journey_id)
		: null;

	return {
		intent: 'booking_confirmed',
		recipientEmail: booking.email,
		recipientName: booking.name,
		leadJourneyId: booking.lead_journey_id,
		campaignId: journey?.campaign_id ?? null,
		campaignPageId: journey?.campaign_page_id ?? null,
		bookingId: booking.id,
		bookingType: booking.booking_type,
		meetingScope: booking.scope,
		requestSummary: booking.scope,
		organization: booking.company,
		confirmedStartsAt: booking.starts_at,
		confirmedEndsAt: booking.ends_at,
		calendarEventUrl: input.calendarEventUrl
	};
}

export function composeBookingLinkInviteEmail(context: BookingLinkInviteEmailContext): {
	subject: string;
	bodyText: string;
} {
	const greetingName = context.recipientName ?? 'there';
	const requestSummary = context.meetingScope
		? `I understand you are reaching out about: ${context.meetingScope}`
		: 'I have your request and will help coordinate the next step.';

	return {
		subject: 'Your booking request is in - choose your time',
		bodyText: [
			`Hi ${greetingName},`,
			'',
			"I'm Woody, Christoph's assistant. Thanks for your submission - we received it.",
			requestSummary,
			'',
			`Please book your preferred slot here: ${context.bookingLinkUrl}`,
			'',
			'Once you choose a time, your booking will be locked in and we will send your confirmation details.',
			'',
			'Best,',
			'Woody'
		].join('\n')
	};
}

export function composeBookingConfirmedEmail(context: BookingConfirmedEmailContext): {
	subject: string;
	bodyText: string;
} {
	const greetingName = context.recipientName ?? 'there';
	const timeRange = formatDateTimeRange({
		startsAt: context.confirmedStartsAt,
		endsAt: context.confirmedEndsAt
	});
	const bookingKindLabel = context.bookingType === 'lead' ? 'lead call' : 'briefing call';

	return {
		subject: 'Your booking is confirmed',
		bodyText: [
			`Hi ${greetingName},`,
			'',
			`I'm Woody, Christoph's assistant. Your ${bookingKindLabel} is now locked in.`,
			`Time: ${timeRange}`,
			`Focus: ${context.meetingScope}`,
			'',
			`Calendar event: ${context.calendarEventUrl}`,
			'',
			'Looking forward to it.',
			'',
			'Best,',
			'Woody'
		].join('\n')
	};
}

export async function sendBookingLinkInviteEmailForLeadSubmission(input: {
	leadJourneyId: string;
}): Promise<BookingLinkInviteWorkflowResult> {
	const journey = await getLeadJourneyById(input.leadJourneyId);
	if (!journey) {
		return { status: 'skipped', reason: 'lead_journey_not_found' };
	}

	if (journey.booking_link_invite_email_sent_at) {
		return { status: 'skipped', reason: 'already_sent' };
	}

	if (!journey.contact_email) {
		return { status: 'skipped', reason: 'missing_recipient_email' };
	}

	const bookingLink = await createBookingLink({
		lead_journey_id: journey.id,
		campaign_id: journey.campaign_id ?? undefined
	});

	const context = await buildBookingLinkInviteEmailContext({
		leadJourneyId: journey.id,
		bookingLinkUrl: bookingLink.url,
		bookingLinkToken: bookingLink.token
	});

	if (!context) {
		return { status: 'skipped', reason: 'context_unavailable' };
	}

	const content = composeBookingLinkInviteEmail(context);
	const delivery = await sendBookingLinkInviteWoodyEmail({
		intent: 'booking_link_invite',
		recipient_email: context.recipientEmail,
		recipient_name: context.recipientName,
		booking_type: 'lead',
		booking_link_url: context.bookingLinkUrl,
		campaign_context: {
			lead_journey_id: context.leadJourneyId,
			campaign_id: context.campaignId,
			campaign_page_id: context.campaignPageId,
			page_slug: context.pageSlug,
			page_path: context.pagePath
		},
		summary_context: {
			meeting_scope: context.meetingScope,
			request_summary: context.requestSummary,
			organization: context.organization,
			booking_mode: context.bookingType
		},
		email_content: {
			subject: content.subject,
			body_text: content.bodyText
		},
		metadata: {
			booking_link_token: context.bookingLinkToken
		}
	});

	await markLeadJourneyBookingLinkInviteEmailSent({
		journeyId: journey.id,
		providerMessageId: delivery.provider_message_id
	});

	return {
		status: 'sent',
		providerMessageId: delivery.provider_message_id
	};
}

export async function sendBookingConfirmedEmail(input: {
	bookingId: string;
	calendarEventUrl: string;
}): Promise<BookingConfirmedWorkflowResult> {
	const booking = await getBookingById(input.bookingId);
	if (!booking) {
		return { status: 'skipped', reason: 'booking_not_found' };
	}

	if (booking.status !== 'confirmed') {
		return { status: 'skipped', reason: 'booking_not_confirmed' };
	}

	if (booking.booking_confirmation_email_sent_at) {
		return { status: 'skipped', reason: 'already_sent' };
	}

	if (!booking.email) {
		return { status: 'skipped', reason: 'missing_recipient_email' };
	}

	const context = await buildBookingConfirmedEmailContext({
		bookingId: booking.id,
		calendarEventUrl: input.calendarEventUrl
	});

	if (!context) {
		return { status: 'skipped', reason: 'context_unavailable' };
	}

	const content = composeBookingConfirmedEmail(context);
	const delivery = await sendBookingConfirmedWoodyEmail({
		intent: 'booking_confirmed',
		recipient_email: context.recipientEmail,
		recipient_name: context.recipientName,
		booking_id: context.bookingId,
		booking_type: context.bookingType as BookingType,
		confirmed_starts_at_iso: context.confirmedStartsAt.toISOString(),
		confirmed_ends_at_iso: context.confirmedEndsAt.toISOString(),
		calendar_event_url: context.calendarEventUrl,
		campaign_context: {
			lead_journey_id: context.leadJourneyId,
			campaign_id: context.campaignId,
			campaign_page_id: context.campaignPageId
		},
		summary_context: {
			meeting_scope: context.meetingScope,
			request_summary: context.requestSummary,
			organization: context.organization,
			booking_mode: context.bookingType
		},
		email_content: {
			subject: content.subject,
			body_text: content.bodyText
		}
	});

	await markBookingConfirmationEmailSent({
		bookingId: booking.id,
		providerMessageId: delivery.provider_message_id
	});

	return {
		status: 'sent',
		providerMessageId: delivery.provider_message_id
	};
}
