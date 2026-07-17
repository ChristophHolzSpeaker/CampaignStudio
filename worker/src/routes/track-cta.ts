import { z } from 'zod';
import { CTA_EVENT_TYPE, ctaTypes } from '../../../shared/event-types';
import { selectOne } from '../lib/db';
import type { WorkerEnv } from '../lib/env';
import { badRequestFromZod, json } from '../lib/http';
import { logLeadEvent } from '../lib/analytics/lead-events';

const trackCTASchema = z.object({
	type: z.enum(ctaTypes),
	campaign_id: z.coerce.number().int().positive(),
	campaign_page_id: z.coerce.number().int().positive(),
	campaign_visit_id: z.coerce.number().int().positive().optional(),
	lead_journey_id: z.string().uuid().optional(),
	session_id: z.string().trim().min(1).max(255).optional(),
	anonymous_id: z.string().trim().min(1).max(255).optional(),
	cta_key: z.string().trim().min(1).max(255).optional(),
	cta_label: z.string().trim().min(1).max(255).optional(),
	cta_section: z.string().trim().min(1).max(255).optional(),
	cta_variant: z.string().trim().min(1).max(255).optional()
});

type CampaignPageRow = {
	id: number;
	campaign_id: number;
};

type CampaignVisitRow = {
	id: number;
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

	let campaignVisitId: number | null = null;
	if (input.campaign_visit_id || input.anonymous_id) {
		const campaignVisitQuery = new URLSearchParams({
			select: 'id',
			campaign_id: `eq.${input.campaign_id}`,
			campaign_page_id: `eq.${input.campaign_page_id}`,
			limit: '1'
		});

		if (input.campaign_visit_id) {
			campaignVisitQuery.set('id', `eq.${input.campaign_visit_id}`);
		} else {
			campaignVisitQuery.set('order', 'visited_at.desc,id.desc');
		}
		if (input.anonymous_id) {
			campaignVisitQuery.set('ip_hash_or_session_identifier', `eq.${input.anonymous_id}`);
		}

		const campaignVisit = await selectOne<CampaignVisitRow>(
			env,
			'campaign_visits',
			campaignVisitQuery
		);
		if (input.campaign_visit_id && !campaignVisit) {
			return json({ ok: false, error: 'Invalid campaign visit attribution' }, 400);
		}
		campaignVisitId = campaignVisit?.id ?? null;
	}

	await logLeadEvent(env, {
		lead_journey_id: input.lead_journey_id ?? null,
		campaign_visit_id: campaignVisitId,
		campaign_id: input.campaign_id,
		campaign_page_id: input.campaign_page_id,
		event_type: CTA_EVENT_TYPE[input.type],
		event_source: 'worker.track_cta',
		cta_key: input.cta_key ?? `legacy_${input.type}_cta`,
		cta_label: input.cta_label ?? null,
		cta_section: input.cta_section ?? null,
		cta_variant: input.cta_variant ?? null,
		event_payload: {
			cta_type: input.type,
			legacy_event_type: `${input.type}_cta_click`,
			path: new URL(request.url).pathname
		},
		session_id: input.session_id ?? null,
		anonymous_id: input.anonymous_id ?? null
	});

	return json({ ok: true });
}
