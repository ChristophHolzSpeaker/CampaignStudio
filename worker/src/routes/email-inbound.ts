import { z } from 'zod';
import { insertOne, selectOne, updateMany } from '../lib/db';
import type { WorkerEnv } from '../lib/env';
import { normalizeEmailAddress, parsePlusAddressAttribution } from '../lib/email';
import { badRequestFromZod, json } from '../lib/http';
import { logLeadEvent } from '../lib/analytics/lead-events';

const INBOUND_WINDOW_DAYS = 30;
const CLOSED_STAGES = ['won', 'lost', 'disqualified', 'archived'];

const emailInboundSchema = z.object({
	to: z.string().trim().min(3),
	from: z.string().trim().min(3),
	subject: z.string().trim().min(1),
	body: z.string().trim().min(1),
	session_id: z.string().trim().min(1).max(255).optional(),
	anonymous_id: z.string().trim().min(1).max(255).optional()
});

type LeadJourneyRow = {
	id: string;
	campaign_id: number | null;
	campaign_page_id: number | null;
	contact_email: string | null;
	current_stage: string;
	updated_at: string;
};

type CampaignPageRow = {
	id: number;
	campaign_id: number;
};

export async function handleEmailInbound(request: Request, env: WorkerEnv): Promise<Response> {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const parsedInput = emailInboundSchema.safeParse(payload);
	if (!parsedInput.success) {
		return badRequestFromZod(parsedInput.error);
	}

	const input = parsedInput.data;
	const normalizedFrom = normalizeEmailAddress(input.from);
	if (!normalizedFrom) {
		return json({ ok: false, error: 'Invalid from email address' }, 400);
	}

	const parsedAttribution = parsePlusAddressAttribution(input.to);
	let resolvedCampaignId: number | null = null;
	let resolvedCampaignPageId: number | null = null;
	let attributionStatus = parsedAttribution.status;

	if (parsedAttribution.status === 'parsed') {
		const campaignPageQuery = new URLSearchParams({
			select: 'id,campaign_id',
			id: `eq.${parsedAttribution.campaign_page_id}`,
			campaign_id: `eq.${parsedAttribution.campaign_id}`,
			limit: '1'
		});
		const campaignPage = await selectOne<CampaignPageRow>(env, 'campaign_pages', campaignPageQuery);
		if (!campaignPage) {
			attributionStatus = 'unresolved_campaign_page';
		} else {
			resolvedCampaignId = campaignPage.campaign_id;
			resolvedCampaignPageId = campaignPage.id;
		}
	}

	let journey: LeadJourneyRow | null = null;
	if (resolvedCampaignId !== null) {
		const windowStart = new Date(
			Date.now() - INBOUND_WINDOW_DAYS * 24 * 60 * 60 * 1000
		).toISOString();
		const matchQuery = new URLSearchParams({
			select: 'id,campaign_id,campaign_page_id,contact_email,current_stage,updated_at',
			contact_email: `eq.${normalizedFrom}`,
			campaign_id: `eq.${resolvedCampaignId}`,
			current_stage: `not.in.(${CLOSED_STAGES.join(',')})`,
			updated_at: `gte.${windowStart}`,
			order: 'updated_at.desc',
			limit: '1'
		});
		journey = await selectOne<LeadJourneyRow>(env, 'lead_journeys', matchQuery);
	}

	if (!journey) {
		journey = await insertOne<LeadJourneyRow>(env, 'lead_journeys', {
			campaign_id: resolvedCampaignId,
			campaign_page_id: resolvedCampaignPageId,
			first_touch_type: 'email',
			first_touch_at: new Date().toISOString(),
			contact_email: normalizedFrom,
			contact_name: null,
			current_stage: 'new'
		});
	} else {
		const updateQuery = new URLSearchParams({
			select: 'id,campaign_id,campaign_page_id,contact_email,current_stage,updated_at',
			id: `eq.${journey.id}`,
			limit: '1'
		});
		const updatedRows = await updateMany<LeadJourneyRow>(env, 'lead_journeys', updateQuery, {
			updated_at: new Date().toISOString(),
			campaign_page_id: journey.campaign_page_id ?? resolvedCampaignPageId
		});
		journey = updatedRows[0] ?? journey;
	}

	await logLeadEvent(env, {
		lead_journey_id: journey.id,
		campaign_id: journey.campaign_id,
		campaign_page_id: journey.campaign_page_id,
		event_type: 'message_received',
		event_source: 'worker.email_inbound',
		event_payload: {
			legacy_event_type: 'email_received',
			to: input.to,
			from: input.from,
			subject: input.subject,
			body: input.body,
			attribution_status: attributionStatus,
			parsed_campaign_id: parsedAttribution.campaign_id,
			parsed_campaign_page_id: parsedAttribution.campaign_page_id
		},
		session_id: input.session_id ?? null,
		anonymous_id: input.anonymous_id ?? null
	});

	return json({
		ok: true,
		lead_journey_id: journey.id,
		attribution_status: attributionStatus
	});
}
