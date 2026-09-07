import { db } from '$lib/server/db';
import { campaigns, campaign_tracking } from '$lib/server/db/schema';
import { getTrackingConfig } from '$lib/server/tracking/config';
import { trackingConfigSchema } from '$lib/tracking/contract';
import { requirePublicApiWriteRequest, publicApiJson } from '$lib/server/public-api/http';
import { readLimitedJson } from '$lib/server/runtime/http';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
const handle: RequestHandler = async ({ request, params }) => {
	const guard = await requirePublicApiWriteRequest(request);
	if (!guard.ok) return guard.response;
	const reply = (data: unknown, status = 200) =>
		publicApiJson(data, guard.context, { status, headers: { 'Cache-Control': 'no-store' } });
	const id = Number(params.id);
	if (!Number.isSafeInteger(id) || id < 1)
		return reply({ ok: false, error: 'Invalid campaign id' }, 400);
	const [campaign] = await db
		.select({ id: campaigns.id })
		.from(campaigns)
		.where(eq(campaigns.id, id))
		.limit(1);
	if (!campaign) return reply({ ok: false, error: 'Campaign not found' }, 404);
	if (request.method === 'GET') return reply({ ok: true, data: await getTrackingConfig(id) });
	let body;
	try {
		body = await readLimitedJson(request, 65536);
	} catch {
		return reply({ ok: false, error: 'Invalid JSON' }, 400);
	}
	const parsed = trackingConfigSchema.safeParse(body);
	if (!parsed.success)
		return reply(
			{ ok: false, error: 'Invalid tracking configuration', issues: parsed.error.issues },
			400
		);
	await db
		.insert(campaign_tracking)
		.values({ campaign_id: id, config: parsed.data })
		.onConflictDoUpdate({
			target: campaign_tracking.campaign_id,
			set: { config: parsed.data, updated_at: new Date() }
		});
	return reply({ ok: true, data: parsed.data });
};
export const GET = handle;
export const PUT = handle;
