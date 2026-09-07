import { z } from 'zod';
import { decodeCursor, nextCursor } from '$lib/server/tracking/pagination';
import { db } from '$lib/server/db';
import {
	tracking_events,
	conversion_deliveries,
	campaign_visits,
	lead_events
} from '$lib/server/db/schema';
import { journeyClicks } from '$lib/server/tracking/attribution';
import { deliveryView } from '$lib/server/tracking/outcomes';
import {
	requirePublicApiRequest,
	publicApiJson,
	parsePositiveInt,
	parseOptionalDate
} from '$lib/server/public-api/http';
import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ request, params, url }) => {
	const guard = await requirePublicApiRequest(request);
	if (!guard.ok) return guard.response;
	const reply = (data: unknown, status = 200) =>
		publicApiJson(data, guard.context, { status, headers: { 'Cache-Control': 'no-store' } });
	if (!z.uuid().safeParse(params.id).success)
		return reply({ ok: false, error: 'Invalid journey id' }, 400);
	const result = await journeyClicks(params.id);
	if (!result) return reply({ ok: false, error: 'Journey not found' }, 404);
	const linked = await db
		.select({ id: lead_events.campaign_visit_id })
		.from(lead_events)
		.where(eq(lead_events.lead_journey_id, params.id));
	const ids = [
		result.journey.first_visit_id,
		result.journey.last_visit_id,
		...linked.map((v) => v.id)
	].filter((v): v is number => v !== null);
	// Include pre-identification activity on the visits that became this journey.
	const limit = parsePositiveInt(url.searchParams.get('limit'), 100, 200);
	let cursor;
	try {
		cursor = decodeCursor(url.searchParams.get('cursor'));
	} catch {
		return reply({ ok: false, error: 'Invalid cursor' }, 400);
	}
	const before = parseOptionalDate(url.searchParams.get('before'));
	const rows = await db
		.select()
		.from(tracking_events)
		.where(
			and(
				or(
					eq(tracking_events.lead_journey_id, params.id),
					ids.length ? inArray(tracking_events.campaign_visit_id, ids) : undefined
				),
				before ? lt(tracking_events.occurred_at, before) : undefined,
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
	const deliveries = rows.length
		? await db
				.select()
				.from(conversion_deliveries)
				.where(
					inArray(
						conversion_deliveries.event_id,
						rows.map((e) => e.id)
					)
				)
		: [];
	return reply({
		ok: true,
		data: {
			clicks: result.clicks.map((c) => ({
				kind: c.kind,
				clickId: c.click_id,
				capturedAt: c.captured_at,
				campaignId: c.campaign_id,
				campaignPageId: c.campaign_page_id
			})),
			events: rows,
			deliveries: deliveries.map(deliveryView)
		},
		pagination: { limit, nextCursor: nextCursor(rows, limit) }
	});
};
