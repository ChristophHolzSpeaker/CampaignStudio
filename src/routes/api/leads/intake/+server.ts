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
import { sendBookingLinkInviteEmailForLeadSubmission } from '$lib/server/bookings/woody-email-service';
import { bookingIntakeSchema } from '$lib/validation/booking-intake';

const WEBFLOW_SURFACE = 'webflow';
const WEBFLOW_DIRECT_CAMPAIGN_NAME = 'Webflow Direct';
const WEBFLOW_EVENT_SOURCE = 'sveltekit.webflow_lead_intake';
const WEBFLOW_NOTIFICATION_FLOW = 'webflow_lead_intake';

const ALLOWED_ORIGINS: string[] = (process.env.PRIVATE_ALLOWED_WEBFLOW_ORIGINS || '')
	.split(',')
	.map((o: string) => o.trim())
	.filter(Boolean);

function isOriginAllowed(origin: string | null, currentOrigin: string): boolean {
	if (!origin) return false;
	if (origin === currentOrigin) return true;
	return ALLOWED_ORIGINS.includes(origin);
}

function corsHeaders(origin: string) {
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type'
	};
}

function allowedJson(data: unknown, init: ResponseInit = {}, origin?: string) {
	const headers = new Headers(init.headers);
	if (origin) {
		Object.entries(corsHeaders(origin)).forEach(([k, v]) => headers.set(k, v));
	}
	return json(data, { ...init, headers });
}

export const OPTIONS: RequestHandler = async ({ request, url }) => {
	const origin = request.headers.get('origin');
	const currentOrigin = url.origin;

	if (isOriginAllowed(origin, currentOrigin)) {
		return new Response(null, {
			status: 204,
			headers: corsHeaders(origin!)
		});
	}

	return new Response(null, { status: 403 });
};

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
		.where(eq(campaigns.name, WEBFLOW_DIRECT_CAMPAIGN_NAME))
		.limit(1);

	if (!sentinel) {
		throw new Error('Webflow direct sentinel campaign not found');
	}

	return { campaignId: sentinel.id, campaignPageId: null };
}

export const POST: RequestHandler = async ({ request, url }) => {
	const origin = request.headers.get('origin');
	const currentOrigin = url.origin;
	const allowedOrigin = isOriginAllowed(origin, currentOrigin) ? origin! : null;

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
		return allowedJson(
			{ success: false, message: parseResult.error.issues[0]?.message ?? 'Invalid submission.' },
			{ status: 400 },
			allowedOrigin || undefined
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
		return allowedJson(
			{ success: false, message: 'Service temporarily unavailable.' },
			{ status: 503 },
			allowedOrigin || undefined
		);
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

	let intentDecision: Awaited<ReturnType<typeof classifyLeadBookingIntent>> | null = null;
	try {
		intentDecision = await classifyLeadBookingIntent({
			scope: parseResult.data.scope,
			company: parseResult.data.company,
			name: parseResult.data.name
		});
	} catch (error) {
		console.error('webflow_lead_intent_classification_failed', {
			error: error instanceof Error ? error.message : 'unknown_error'
		});
	}

	const intentApproved = intentDecision ? isLeadBookingIntentApproved(intentDecision) : false;

	const normalizedEmail = normalizeEmailAddress(parseResult.data.email);
	if (!normalizedEmail) {
		return allowedJson(
			{ success: false, message: 'Please provide a valid email address.' },
			{ status: 400 },
			allowedOrigin || undefined
		);
	}

	const now = new Date();
	const { journey } = await findOrCreateLeadJourneyFromInquiry({
		campaignId: campaignContext.campaignId,
		campaignPageId: campaignContext.campaignPageId,
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
			attribution: {
				page_path: pagePath,
				page_slug: pageSlug,
				campaign_page_id: campaignContext.campaignPageId
			},
			form: {
				email: normalizedEmail,
				full_name: parseResult.data.name ?? '',
				phone: parseResult.data.phone ?? '',
				organization: parseResult.data.company ?? '',
				meeting_scope: parseResult.data.scope,
				form_type: 'webflow_lead_intake'
			},
			qualification: intentDecision,
			intent_approved: intentApproved,
			booking_surface: WEBFLOW_SURFACE
		}
	});

	if (intentApproved) {
		try {
			await sendBookingLinkInviteEmailForLeadSubmission({ leadJourneyId: journey.id });
		} catch (emailError) {
			console.error('webflow_woody_booking_link_invite_failed', {
				lead_journey_id: journey.id,
				error: emailError instanceof Error ? emailError.message : 'unknown_email_error'
			});
		}
	}

	return allowedJson(
		{
			success: true,
			message: 'Thank you. Your request has been received and we will respond by email shortly.'
		},
		{},
		allowedOrigin || undefined
	);
};
