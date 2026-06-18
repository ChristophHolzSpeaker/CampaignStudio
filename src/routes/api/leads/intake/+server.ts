import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { campaigns, campaign_pages } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeEmailAddress } from '$lib/server/attribution/email';
import { logLeadEvent } from '$lib/server/attribution/lead-events';
import { findOrCreateLeadJourneyFromInquiry } from '$lib/server/attribution/lead-journeys';
import { notifyBookingFormSubmission } from '$lib/server/notifications/booking-form-submission';
import {
	classifyLeadBookingIntent,
	isLeadBookingIntentApproved
} from '$lib/server/bookings/intent-classification';
import { bookingIntakeSchema } from '$lib/validation/booking-intake';

const WEBFLOW_SURFACE = 'webflow';
const WEBFLOW_DIRECT_CAMPAIGN_SLUG = 'webflow-direct';
const WEBFLOW_EVENT_SOURCE = 'sveltekit.webflow_lead_intake';
const WEBFLOW_NOTIFICATION_FLOW = 'webflow_lead_intake';

function readSingleString(input: unknown): string | undefined {
	if (typeof input === 'string') return input;
	if (Array.isArray(input)) {
		const first = input[0];
		return typeof first === 'string' ? first : undefined;
	}
	return undefined;
}

async function resolveWebflowCampaignContext(campaignId?: number, campaignPageId?: number) {
	if (
		Number.isInteger(campaignId) &&
		campaignId! > 0 &&
		Number.isInteger(campaignPageId) &&
		campaignPageId! > 0
	) {
		const [page] = await db
			.select({ campaignId: campaign_pages.campaign_id, campaignPageId: campaign_pages.id })
			.from(campaign_pages)
			.where(eq(campaign_pages.id, campaignPageId!))
			.limit(1);

		if (page && page.campaignId === campaignId) {
			return { campaignId: page.campaignId, campaignPageId: page.campaignPageId };
		}
	}

	// Fallback to sentinel
	const [sentinel] = await db
		.select({ id: campaigns.id })
		.from(campaigns)
		.where(eq(campaigns.slug, WEBFLOW_DIRECT_CAMPAIGN_SLUG))
		.limit(1);

	if (!sentinel) {
		throw new Error('Webflow direct sentinel campaign not found');
	}

	return { campaignId: sentinel.id, campaignPageId: null };
}

export const POST: RequestHandler = async ({ request, url }) => {
	let raw: Record<string, unknown>;

	const contentType = request.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		raw = await request.json();
	} else {
		const form = await request.formData();
		raw = Object.fromEntries(form.entries());
	}

	const intake = {
		email: readSingleString(raw.email) ?? '',
		name: readSingleString(raw.name) ?? '',
		phone: readSingleString(raw.phone) ?? '',
		company: readSingleString(raw.company) ?? '',
		scope: readSingleString(raw.scope) ?? ''
	};

	const parseResult = bookingIntakeSchema.safeParse(intake);
	if (!parseResult.success) {
		return json(
			{ success: false, message: parseResult.error.issues[0]?.message ?? 'Invalid submission.' },
			{ status: 400 }
		);
	}

	const campaignIdInput = Number(readSingleString(raw.campaignId));
	const campaignPageIdInput = Number(readSingleString(raw.campaignPageId));
	const pageSlug = readSingleString(raw.pageSlug) ?? null;
	const pagePath = url.pathname;

	let campaignContext: { campaignId: number; campaignPageId: number | null };
	try {
		campaignContext = await resolveWebflowCampaignContext(
			Number.isNaN(campaignIdInput) ? undefined : campaignIdInput,
			Number.isNaN(campaignPageIdInput) ? undefined : campaignPageIdInput
		);
	} catch {
		return json({ success: false, message: 'Service temporarily unavailable.' }, { status: 503 });
	}

	try {
		await notifyBookingFormSubmission({
			flow: WEBFLOW_NOTIFICATION_FLOW,
			email: parseResult.data.email,
			name: parseResult.data.name ?? null,
			phone: parseResult.data.phone ?? null,
			company: parseResult.data.company ?? null,
			scope: parseResult.data.scope,
			campaignId: campaignContext.campaignId,
			campaignPageId: campaignContext.campaignPageId,
			pageSlug,
			pagePath
		});
	} catch (error) {
		console.error('webflow_booking_form_submission_notification_failed', {
			error: error instanceof Error ? error.message : 'unknown_error'
		});
	}

	let intentDecision;
	try {
		intentDecision = await classifyLeadBookingIntent({
			scope: parseResult.data.scope,
			company: parseResult.data.company,
			name: parseResult.data.name
		});
	} catch {
		return json(
			{
				success: false,
				message:
					'We could not verify your request at this time. Please try again shortly or email us directly.'
			},
			{ status: 400 }
		);
	}

	if (!isLeadBookingIntentApproved(intentDecision)) {
		return json(
			{
				success: false,
				message:
					'Thank you. This booking path is reserved exclusively for speaking engagement inquiries.'
			},
			{ status: 400 }
		);
	}

	const normalizedEmail = normalizeEmailAddress(parseResult.data.email);
	if (!normalizedEmail) {
		return json(
			{ success: false, message: 'Please provide a valid email address.' },
			{ status: 400 }
		);
	}

	const now = new Date();
	const { journey } = await findOrCreateLeadJourneyFromInquiry({
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId ?? 0,
		contactEmail: normalizedEmail,
		contactName: parseResult.data.name ?? '',
		visitorIdentifier: null,
		now
	});

	await logLeadEvent({
		leadJourneyId: journey.id,
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId,
		eventType: 'form_submitted',
		eventSource: WEBFLOW_EVENT_SOURCE,
		eventPayload: {
			form: {
				email: normalizedEmail,
				full_name: parseResult.data.name ?? '',
				phone: parseResult.data.phone ?? '',
				organization: parseResult.data.company ?? '',
				meeting_scope: parseResult.data.scope,
				form_type: 'webflow_lead_intake'
			},
			qualification: intentDecision,
			booking_surface: WEBFLOW_SURFACE
		}
	});

	return json({
		success: true,
		message: 'Thank you. Woody will review your request and respond by email shortly.'
	});
};
