import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { visitConsentSchema } from '$lib/tracking/contract';
import {
	enforceSameOrigin,
	enforceRuntimeRateLimit,
	readLimitedJson
} from '$lib/server/runtime/http';
import { readVisitorIdentifier } from '$lib/server/attribution/campaign-visits';
import { resolvePublishedCampaignPageContext } from '$lib/server/attribution/campaign-context';
import { recordVisitConsent } from '$lib/server/tracking/visits';
import { OutcomeError } from '$lib/server/tracking/errors';
import type { RequestHandler } from './$types';
const schema = visitConsentSchema.extend({
	visitId: z.number().int().positive(),
	campaignPageId: z.number().int().positive()
});
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const reply = (body: unknown, status = 200) =>
		json(body, { status, headers: { 'Cache-Control': 'no-store' } });
	const originError = enforceSameOrigin(request, url);
	if (originError) return originError;
	const visitorIdentifier = readVisitorIdentifier(cookies);
	if (!visitorIdentifier) return reply({ ok: false, error: 'Visitor context is missing' }, 400);
	const rateError = await enforceRuntimeRateLimit(visitorIdentifier);
	if (rateError) return rateError;
	let body;
	try {
		body = await readLimitedJson(request);
	} catch {
		return reply({ ok: false, error: 'Invalid JSON' }, 400);
	}
	const parsed = schema.safeParse(body);
	if (!parsed.success) return reply({ ok: false, error: 'Invalid consent record' }, 400);
	const { visitId, campaignPageId, ...consent } = parsed.data;
	const page = await resolvePublishedCampaignPageContext({ campaignPageId });
	if (!page) return reply({ ok: false, error: 'Published page not found' }, 404);
	try {
		const decision = await recordVisitConsent(visitId, consent, {
			visitorIdentifier,
			campaignPageId
		});
		// Preserve identity until the actual choice expires, including when renewed.
		if (decision.expiresAt)
			cookies.set('cs_vid', visitorIdentifier, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: url.protocol === 'https:',
				expires: decision.expiresAt
			});
		return reply({ ok: true, data: decision });
	} catch (e) {
		if (e instanceof OutcomeError) return reply({ ok: false, error: e.message }, e.status);
		throw e;
	}
};
