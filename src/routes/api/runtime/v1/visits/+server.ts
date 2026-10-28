import { OutcomeError } from '$lib/server/tracking/errors';
import { createVisitReceipt, verifyVisitReceipt } from '$lib/server/attribution/visit-receipt';
import { getTrackingConfig } from '$lib/server/tracking/config';
import { browserStatisticsAllowed, readBrowserConsent } from '$lib/server/tracking/browser-consent';
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
	pageUrl: z.string().max(2048),
	consentOnly: z.boolean().optional(),
	baselineOnly: z.boolean().optional(),
	visitReceipt: z.string().max(1024).optional()
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
	const baseline = page.runtimeVersion === 'v6' && Boolean(parsed.data.baselineOnly);
	const policy =
		page.runtimeVersion === 'v6' && !baseline
			? (await getTrackingConfig(page.campaignId)).consent
			: null;
	const statisticsAllowed = !policy || browserStatisticsAllowed(cookies, policy);
	if (!statisticsAllowed && !parsed.data.consentOnly && !parsed.data.baselineOnly)
		return json({ ok: false, error: 'Statistics consent required' }, { status: 403 });
	const receiptVisitId = parsed.data.visitReceipt
		? verifyVisitReceipt(parsed.data.visitReceipt, page.campaignPageId)
		: null;
	if (parsed.data.visitReceipt && !receiptVisitId)
		return json({ ok: false, error: 'Invalid visit receipt' }, { status: 403 });
	const visitorIdentifier = baseline
		? null
		: getOrCreateVisitorIdentifier({
				cookies,
				secureCookie: url.protocol === 'https:',
				...(policy ? { maxAge: policy.retentionDays * 86400 } : {})
			});
	const rateError = await enforceRuntimeRateLimit(
		visitorIdentifier ?? request.headers.get('x-forwarded-for') ?? 'anonymous'
	);
	if (rateError) return rateError;
	let result;
	try {
		result = await logCampaignVisit({
			campaignId: page.campaignId,
			campaignPageId: page.campaignPageId,
			slug: page.slug,
			searchParams: pageUrl.searchParams,
			headers: request.headers,
			visitorIdentifier,
			receiptVisitId: !baseline ? (receiptVisitId ?? undefined) : undefined,
			consentOnly: !baseline && Boolean(policy && !statisticsAllowed),
			captureAds: baseline
				? false
				: policy
					? readBrowserConsent(cookies, policy)?.marketing === true
					: true
		});
	} catch (cause) {
		if (cause instanceof OutcomeError)
			return json({ ok: false, error: cause.message }, { status: cause.status });
		throw cause;
	}
	return json(
		{
			ok: true,
			data: {
				...result,
				...(baseline && result.visitId
					? { visitReceipt: createVisitReceipt(result.visitId, page.campaignPageId) }
					: {})
			}
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
