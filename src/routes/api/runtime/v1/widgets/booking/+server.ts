import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { getPublishedArtifactPageById } from '$lib/server/artifacts/repository';
import { createBookingWidgetToken } from '$lib/server/artifacts/widget-token';
import { readVisitorIdentifier } from '$lib/server/attribution/campaign-visits';
import {
	enforceRuntimeRateLimit,
	enforceSameOrigin,
	readLimitedJson
} from '$lib/server/runtime/http';
import type { RequestHandler } from './$types';

const schema = z.object({ campaignPageId: z.number().int().positive() });
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const originError = enforceSameOrigin(request, url);
	if (originError) return originError;
	let parsed;
	try {
		parsed = schema.safeParse(await readLimitedJson(request));
	} catch {
		return json({ ok: false, error: 'Invalid request body' }, { status: 400 });
	}
	if (!parsed.success) return json({ ok: false, error: 'Invalid widget request' }, { status: 400 });
	const page = await getPublishedArtifactPageById(parsed.data.campaignPageId);
	if (!page)
		return json({ ok: false, error: 'Published artifact page not found' }, { status: 404 });
	const rateError = await enforceRuntimeRateLimit(
		readVisitorIdentifier(cookies) ?? request.headers.get('x-forwarded-for') ?? 'anonymous'
	);
	if (rateError) return rateError;
	const widgetUrl = new URL('/widgets/booking', url.origin);
	widgetUrl.searchParams.set('context', createBookingWidgetToken(page, false));
	return json({ ok: true, data: { url: `${widgetUrl.pathname}${widgetUrl.search}` } });
};
