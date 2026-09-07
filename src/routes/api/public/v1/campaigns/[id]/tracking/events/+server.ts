import { db } from '$lib/server/db';
import { campaigns, tracking_events } from '$lib/server/db/schema';
import {
	requirePublicApiRequest,
	publicApiJson,
	parsePositiveInt
} from '$lib/server/public-api/http';
import { decodeCursor, nextCursor } from '$lib/server/tracking/pagination';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ request, url, params }) => {
	const guard = await requirePublicApiRequest(request);
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
	let cursor;
	try {
		cursor = decodeCursor(url.searchParams.get('cursor'));
	} catch {
		return reply({ ok: false, error: 'Invalid cursor' }, 400);
	}
	const limit = parsePositiveInt(url.searchParams.get('limit'), 100, 200);
	const rows = await db
		.select()
		.from(tracking_events)
		.where(
			and(
				eq(tracking_events.campaign_id, id),
				cursor
					? or(
							lt(tracking_events.occurred_at, new Date(cursor.at)),
							and(
								eq(tracking_events.occurred_at, new Date(cursor.at)),
								lt(tracking_events.id, cursor.id)
							)
						)
					: undefined
			)
		)
		.orderBy(desc(tracking_events.occurred_at), desc(tracking_events.id))
		.limit(limit);
	return reply({
		ok: true,
		data: rows,
		pagination: { limit, nextCursor: nextCursor(rows, limit) }
	});
};
