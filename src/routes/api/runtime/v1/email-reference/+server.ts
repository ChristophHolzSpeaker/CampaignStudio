import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { readVisitorIdentifier } from '$lib/server/attribution/campaign-visits';
import { resolvePublishedCampaignPageContext } from '$lib/server/attribution/campaign-context';
import { issueEmailVisitReference } from '$lib/server/attribution/email-reference';
import {
	enforceSameOrigin,
	enforceRuntimeRateLimit,
	readLimitedJson
} from '$lib/server/runtime/http';
import type { RequestHandler } from './$types';

const schema = z
	.object({
		campaignPageId: z.number().int().positive(),
		visitId: z.number().int().positive().optional()
	})
	.strict();
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const originError = enforceSameOrigin(request, url);
	if (originError) return originError;
	const reply = (body: unknown, status = 200) =>
		json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
	const visitorIdentifier = readVisitorIdentifier(cookies);
	if (!visitorIdentifier) return reply({ ok: false, error: 'Visitor context is missing' }, 409);
	const rateError = await enforceRuntimeRateLimit(visitorIdentifier);
	if (rateError) return rateError;
	let parsed;
	try {
		parsed = schema.safeParse(await readLimitedJson(request));
	} catch {
		return reply({ ok: false, error: 'Invalid request body' }, 400);
	}
	if (!parsed.success) return reply({ ok: false, error: 'Invalid email reference request' }, 400);
	const context = await resolvePublishedCampaignPageContext({
		campaignPageId: parsed.data.campaignPageId
	});
	if (!context) return reply({ ok: false, error: 'Published page not found' }, 404);
	const reference = await issueEmailVisitReference({
		...context,
		visitorIdentifier,
		requestedVisitId: parsed.data.visitId
	});
	return reference
		? reply({ ok: true, data: { reference } })
		: reply({ ok: false, error: 'Visit is not ready' }, 409);
};
