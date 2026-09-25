import { requirePublicApiRequest, publicApiJson } from '$lib/server/public-api/http';
import { visitTrackingQuerySchema } from '$lib/tracking/contract';
import { getVisitTracking } from '$lib/server/tracking/visits';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ request, params, url }) => {
	const guard = await requirePublicApiRequest(request);
	if (!guard.ok) return guard.response;
	const reply = (body: unknown, status = 200) =>
		publicApiJson(body, guard.context, { status, headers: { 'Cache-Control': 'no-store' } });
	const id = Number(params.id);
	if (!Number.isSafeInteger(id) || id < 1)
		return reply({ ok: false, error: 'Invalid visit id' }, 400);
	const query = visitTrackingQuerySchema.safeParse(Object.fromEntries(url.searchParams));
	if (!query.success) return reply({ ok: false, error: 'Invalid tracking query' }, 400);
	const data = await getVisitTracking(id, query.data);
	return data ? reply({ ok: true, data }) : reply({ ok: false, error: 'Visit not found' }, 404);
};
