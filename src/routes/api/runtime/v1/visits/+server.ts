import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { getPublishedArtifactPageById } from '$lib/server/artifacts/repository';
import {
	getOrCreateVisitorIdentifier,
	logCampaignVisit
} from '$lib/server/attribution/campaign-visits';
import {
	enforceRuntimeRateLimit,
	enforceSameOrigin,
	readLimitedJson
} from '$lib/server/runtime/http';
import type { RequestHandler } from './$types';

const schema = z.object({
	campaignPageId: z.number().int().positive(),
	pageUrl: z.string().max(2048)
});

export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const originError = enforceSameOrigin(request, url);
	if (originError) return originError;
	let parsed;
	try {
		parsed = schema.safeParse(await readLimitedJson(request));
	} catch {
		return json({ ok: false, error: 'Invalid request body' }, { status: 400 });
	}
	if (!parsed.success) return json({ ok: false, error: 'Invalid visit payload' }, { status: 400 });
	const page = await getPublishedArtifactPageById(parsed.data.campaignPageId);
	if (!page)
		return json({ ok: false, error: 'Published artifact page not found' }, { status: 404 });
	const pageUrl = new URL(parsed.data.pageUrl, url.origin);
	if (pageUrl.origin !== url.origin || pageUrl.pathname !== `/${page.slug}`)
		return json({ ok: false, error: 'Page context mismatch' }, { status: 400 });
	const visitorIdentifier = getOrCreateVisitorIdentifier({
		cookies,
		secureCookie: url.protocol === 'https:'
	});
	const rateError = await enforceRuntimeRateLimit(visitorIdentifier);
	if (rateError) return rateError;
	const result = await logCampaignVisit({
		campaignId: page.campaignId,
		campaignPageId: page.campaignPageId,
		slug: page.slug,
		searchParams: pageUrl.searchParams,
		headers: request.headers,
		visitorIdentifier
	});
	return json({ ok: true, data: result });
};
