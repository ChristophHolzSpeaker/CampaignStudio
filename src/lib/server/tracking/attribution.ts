import { db } from '$lib/server/db';
import { ad_clicks, campaign_visits, lead_journeys, lead_events } from '$lib/server/db/schema';
import { and, desc, eq, inArray, lte, or } from 'drizzle-orm';

export async function captureAdClicks(input: {
	visitorIdentifier: string;
	campaignId: number;
	campaignPageId: number;
	searchParams: URLSearchParams;
}) {
	for (const kind of ['gclid', 'gbraid', 'wbraid']) {
		const clickId = input.searchParams.get(kind);
		if (!clickId || !/^[A-Za-z0-9_.~-]{1,512}$/.test(clickId)) continue;
		await db
			.insert(ad_clicks)
			.values({
				visitor_id: input.visitorIdentifier,
				campaign_id: input.campaignId,
				campaign_page_id: input.campaignPageId,
				kind,
				click_id: clickId
			})
			.onConflictDoNothing();
	}
}
// Use recorded visit ownership, never IP enrichment or browser-supplied lead IDs.
export async function journeyClicks(journeyId: string, before = new Date()) {
	const [journey] = await db
		.select()
		.from(lead_journeys)
		.where(eq(lead_journeys.id, journeyId))
		.limit(1);
	if (!journey) return null;
	const linked = await db
		.select({ id: lead_events.campaign_visit_id })
		.from(lead_events)
		.where(eq(lead_events.lead_journey_id, journeyId));
	const visitIds = [
		...new Set(
			[journey.first_visit_id, journey.last_visit_id, ...linked.map((e) => e.id)].filter(
				(id): id is number => id !== null
			)
		)
	];
	if (!visitIds.length) return { journey, clicks: [] };
	const visits = await db
		.select({ visitor: campaign_visits.ip_hash_or_session_identifier })
		.from(campaign_visits)
		.where(inArray(campaign_visits.id, visitIds));
	const visitors = visits.map((v) => v.visitor).filter((id): id is string => Boolean(id));
	const clicks = visitors.length
		? await db
				.select()
				.from(ad_clicks)
				.where(and(inArray(ad_clicks.visitor_id, visitors), lte(ad_clicks.captured_at, before)))
				.orderBy(desc(ad_clicks.captured_at))
		: [];
	return { journey, clicks };
}
export async function journeyForVisit(visitId: number) {
	const [row] = await db
		.select({ id: lead_journeys.id })
		.from(lead_journeys)
		.where(or(eq(lead_journeys.first_visit_id, visitId), eq(lead_journeys.last_visit_id, visitId)))
		.orderBy(desc(lead_journeys.updated_at))
		.limit(1);
	return row?.id ?? null;
}
