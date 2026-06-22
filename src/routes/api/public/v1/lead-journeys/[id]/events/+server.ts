import { db } from '$lib/server/db';
import { lead_events } from '$lib/server/db/schema';
import {
	parseOptionalDate,
	parsePositiveInt,
	publicApiJson,
	requirePublicApiRequest
} from '$lib/server/public-api/http';
import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ request, params, url }) => {
	const guard = await requirePublicApiRequest(request);
	if (!guard.ok) return guard.response;

	if (!UUID_PATTERN.test(params.id)) {
		return publicApiJson({ ok: false, error: 'Invalid journey id' }, guard.context, {
			status: 400
		});
	}

	const limit = parsePositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
	const occurredAfter = parseOptionalDate(url.searchParams.get('occurred_after'));
	const occurredBefore = parseOptionalDate(url.searchParams.get('occurred_before'));
	const eventType = url.searchParams.get('event_type');
	const eventSource = url.searchParams.get('event_source');

	const whereClauses: SQL[] = [eq(lead_events.lead_journey_id, params.id)];
	if (occurredAfter) whereClauses.push(gte(lead_events.occurred_at, occurredAfter));
	if (occurredBefore) whereClauses.push(lt(lead_events.occurred_at, occurredBefore));
	if (eventType) whereClauses.push(eq(lead_events.event_type, eventType));
	if (eventSource) whereClauses.push(eq(lead_events.event_source, eventSource));

	const rows = await db
		.select({
			id: lead_events.id,
			leadJourneyId: lead_events.lead_journey_id,
			campaignId: lead_events.campaign_id,
			campaignPageId: lead_events.campaign_page_id,
			eventType: lead_events.event_type,
			eventSource: lead_events.event_source,
			eventPayload: lead_events.event_payload,
			ctaKey: lead_events.cta_key,
			ctaLabel: lead_events.cta_label,
			ctaSection: lead_events.cta_section,
			ctaVariant: lead_events.cta_variant,
			sessionId: lead_events.session_id,
			anonymousId: lead_events.anonymous_id,
			occurredAt: lead_events.occurred_at
		})
		.from(lead_events)
		.where(and(...whereClauses))
		.orderBy(desc(lead_events.occurred_at))
		.limit(limit);

	return publicApiJson(
		{
			ok: true,
			data: rows,
			pagination: {
				limit,
				count: rows.length,
				nextOccurredBefore: rows.length === limit ? rows.at(-1)?.occurredAt : null
			}
		},
		guard.context
	);
};
