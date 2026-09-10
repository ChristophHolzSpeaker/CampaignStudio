import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { tracking_events } from '$lib/server/db/schema';
import { measurementSchema } from '$lib/tracking/contract';
import {
	readVisitorIdentifier,
	resolveCampaignVisitId
} from '$lib/server/attribution/campaign-visits';
import { resolvePublishedCampaignPageContext } from '$lib/server/attribution/campaign-context';
import {
	enforceRuntimeRateLimit,
	enforceSameOrigin,
	readLimitedJson
} from '$lib/server/runtime/http';
import { journeyForVisit } from '$lib/server/tracking/attribution';
import type { RequestHandler } from './$types';
const schema = z
	.object({
		campaignPageId: z.number().int().positive(),
		visitId: z.number().int().positive(),
		events: z.array(measurementSchema).min(1).max(30)
	})
	.strict();
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const origin = enforceSameOrigin(request, url);
	if (origin) return origin;
	const visitor = readVisitorIdentifier(cookies);
	if (!visitor) return json({ ok: false, error: 'Visit required' }, { status: 401 });
	const rate = await enforceRuntimeRateLimit(visitor);
	if (rate) return rate;
	let body;
	try {
		body = await readLimitedJson(request);
	} catch {
		return json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
	}
	const parsed = schema.safeParse(body);
	if (!parsed.success) return json({ ok: false, error: 'Invalid events' }, { status: 400 });
	const page = await resolvePublishedCampaignPageContext({
		campaignPageId: parsed.data.campaignPageId
	});
	if (!page) return json({ ok: false, error: 'Page not found' }, { status: 404 });
	const visit = await resolveCampaignVisitId({
		campaignId: page.campaignId,
		campaignPageId: page.campaignPageId,
		visitorIdentifier: visitor,
		requestedVisitId: parsed.data.visitId
	});
	if (!visit)
		return json(
			{ ok: false, error: 'Visit does not belong to this browser/page' },
			{ status: 403 }
		);
	const journey = await journeyForVisit(visit);
	await db
		.insert(tracking_events)
		.values(
			parsed.data.events.map((e) => ({
				id: e.id,
				campaign_id: page.campaignId,
				campaign_page_id: page.campaignPageId,
				campaign_visit_id: visit,
				lead_journey_id: journey,
				event_name: e.name,
				source: 'runtime',
				action: e.action,
				section: e.section,
				payload: e
			}))
		)
		.onConflictDoNothing();
	return new Response(null, { status: 204 });
};
