import { logLeadEvent } from '$lib/server/attribution/lead-events';
import {
	readVisitorIdentifier,
	resolveCampaignVisitId
} from '$lib/server/attribution/campaign-visits';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

const formStartedSchema = z.object({
	campaign_id: z.number().int().positive(),
	campaign_page_id: z.number().int().positive(),
	page_path: z.string().trim().min(1).max(255),
	form_key: z.string().trim().min(1).max(255)
});

export const POST: RequestHandler = async ({ request, cookies }) => {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
	}

	const parsed = formStartedSchema.safeParse(payload);
	if (!parsed.success) {
		return json({ ok: false, error: 'Invalid request payload' }, { status: 400 });
	}

	const visitorIdentifier = readVisitorIdentifier(cookies);
	const campaignVisitId = await resolveCampaignVisitId({
		campaignId: parsed.data.campaign_id,
		campaignPageId: parsed.data.campaign_page_id,
		visitorIdentifier
	});

	await logLeadEvent({
		campaignVisitId,
		campaignId: parsed.data.campaign_id,
		campaignPageId: parsed.data.campaign_page_id,
		anonymousId: visitorIdentifier,
		eventType: 'form_started',
		eventSource: 'sveltekit.frictionless_funnel_form',
		eventPayload: {
			form_key: parsed.data.form_key,
			page_path: parsed.data.page_path
		}
	});

	return json({ ok: true });
};
