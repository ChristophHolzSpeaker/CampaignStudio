import { z } from 'zod';
import { CTA_EVENT_TYPE, ctaTypes } from '../../../shared/event-types';
import { insertOne, selectOne } from '../lib/db';
import type { WorkerEnv } from '../lib/env';
import { badRequestFromZod, json } from '../lib/http';

const trackCTASchema = z.object({
	type: z.enum(ctaTypes),
	campaign_id: z.coerce.number().int().positive(),
	campaign_page_id: z.coerce.number().int().positive(),
	lead_journey_id: z.string().uuid().optional(),
	session_id: z.string().trim().min(1).max(255).optional(),
	anonymous_id: z.string().trim().min(1).max(255).optional()
});

type CampaignPageRow = {
	id: number;
	campaign_id: number;
};

export async function handleTrackCTA(request: Request, env: WorkerEnv): Promise<Response> {
	const parsedInput = trackCTASchema.safeParse(
		Object.fromEntries(new URL(request.url).searchParams)
	);
	if (!parsedInput.success) {
		return badRequestFromZod(parsedInput.error);
	}

	const input = parsedInput.data;
	const campaignPageQuery = new URLSearchParams({
		select: 'id,campaign_id',
		id: `eq.${input.campaign_page_id}`,
		campaign_id: `eq.${input.campaign_id}`,
		limit: '1'
	});
	const campaignPage = await selectOne<CampaignPageRow>(env, 'campaign_pages', campaignPageQuery);
	if (!campaignPage) {
		return json({ ok: false, error: 'Invalid campaign_id/campaign_page_id pair' }, 400);
	}

	await insertOne(env, 'lead_events', {
		lead_journey_id: input.lead_journey_id ?? null,
		campaign_id: input.campaign_id,
		campaign_page_id: input.campaign_page_id,
		event_type: CTA_EVENT_TYPE[input.type],
		event_source: 'worker.track_cta',
		event_payload: {
			cta_type: input.type,
			path: new URL(request.url).pathname
		},
		session_id: input.session_id ?? null,
		anonymous_id: input.anonymous_id ?? null
	});

	return json({ ok: true });
}
