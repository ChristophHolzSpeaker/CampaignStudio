import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { getPublishedArtifactPageById } from '$lib/server/artifacts/repository';
import {
	markCampaignVisitEngaged,
	readVisitorIdentifier
} from '$lib/server/attribution/campaign-visits';
import {
	enforceRuntimeRateLimit,
	enforceSameOrigin,
	readLimitedJson
} from '$lib/server/runtime/http';
import type { RequestHandler } from './$types';

const schema = z.object({
	campaignPageId: z.number().int().positive(),
	visitId: z.number().int().positive(),
	durationMs: z
		.number()
		.int()
		.nonnegative()
		.max(24 * 60 * 60 * 1000)
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
	if (!parsed.success || !(await getPublishedArtifactPageById(parsed.data.campaignPageId)))
		return json({ ok: false, error: 'Invalid page engagement payload' }, { status: 400 });
	const visitor = readVisitorIdentifier(cookies);
	if (!visitor) return json({ ok: false, error: 'Visitor context is missing' }, { status: 400 });
	const rateError = await enforceRuntimeRateLimit(visitor);
	if (rateError) return rateError;
	return json({
		ok: true,
		data: await markCampaignVisitEngaged({
			visitId: parsed.data.visitId,
			visitorIdentifier: visitor,
			durationMs: parsed.data.durationMs
		})
	});
};
