import { trackCTA } from '$lib/server/attribution/client';
import {
	readVisitorIdentifier,
	resolveCampaignVisitId
} from '$lib/server/attribution/campaign-visits';
import { ctaTypes } from '../../../../../shared/event-types';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const trackCtaRequestSchema = z.object({
	type: z.enum(ctaTypes),
	campaign_id: z.number().int().positive(),
	campaign_page_id: z.number().int().positive(),
	campaign_visit_id: z.number().int().positive().optional(),
	lead_journey_id: z.string().uuid().optional(),
	session_id: z.string().trim().min(1).max(255).optional(),
	anonymous_id: z.string().trim().min(1).max(255).optional(),
	cta_key: z.string().trim().min(1).max(255).optional(),
	cta_label: z.string().trim().min(1).max(255).optional(),
	cta_section: z.string().trim().min(1).max(255).optional(),
	cta_variant: z.string().trim().min(1).max(255).optional()
});

export const POST: RequestHandler = async ({ request, cookies }) => {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
	}

	const parsed = trackCtaRequestSchema.safeParse(payload);
	if (!parsed.success) {
		return json(
			{
				ok: false,
				error: 'Validation failed',
				details: parsed.error.flatten()
			},
			{ status: 400 }
		);
	}

	try {
		const visitorIdentifier = cookies ? readVisitorIdentifier(cookies) : null;
		const campaignVisitId = await resolveCampaignVisitId({
			campaignId: parsed.data.campaign_id,
			campaignPageId: parsed.data.campaign_page_id,
			visitorIdentifier,
			requestedVisitId: parsed.data.campaign_visit_id
		});
		const trackingInput = { ...parsed.data };
		delete trackingInput.campaign_visit_id;
		delete trackingInput.anonymous_id;

		await trackCTA({
			...trackingInput,
			...(campaignVisitId ? { campaign_visit_id: campaignVisitId } : {}),
			...(visitorIdentifier ? { anonymous_id: visitorIdentifier } : {})
		});
	} catch (trackingError) {
		console.error('CTA tracking failed', trackingError);
	}

	return new Response(null, { status: 204 });
};
