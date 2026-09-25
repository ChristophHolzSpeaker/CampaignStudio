import { db } from '$lib/server/db';
import {
	ad_clicks,
	campaign_visits,
	lead_journeys,
	lead_events,
	visit_ad_clicks
} from '$lib/server/db/schema';
import { and, desc, eq, inArray, lte, or } from 'drizzle-orm';

export async function captureAdClicks(input: {
	visitorIdentifier: string;
	visitId: number;
	campaignId: number;
	campaignPageId: number;
	searchParams: URLSearchParams;
}) {
	for (const kind of ['gclid', 'gbraid', 'wbraid']) {
		const clickId = input.searchParams.get(kind);
		if (!clickId || !/^[A-Za-z0-9_.~-]{1,512}$/.test(clickId)) continue;
		const inserted = await db
			.insert(ad_clicks)
			.values({
				visitor_id: input.visitorIdentifier,
				campaign_id: input.campaignId,
				campaign_page_id: input.campaignPageId,
				kind,
				click_id: clickId
			})
			.onConflictDoNothing()
			.returning();
		if (input.visitId) {
			const click =
				inserted[0] ??
				(
					await db
						.select()
						.from(ad_clicks)
						.where(
							and(
								eq(ad_clicks.visitor_id, input.visitorIdentifier),
								eq(ad_clicks.kind, kind),
								eq(ad_clicks.click_id, clickId)
							)
						)
						.limit(1)
				)[0];
			if (click)
				await db
					.insert(visit_ad_clicks)
					.values({ campaign_visit_id: input.visitId, ad_click_id: click.id })
					.onConflictDoNothing();
		}
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
	const clicks = await db
		.select({ click: ad_clicks })
		.from(visit_ad_clicks)
		.innerJoin(ad_clicks, eq(ad_clicks.id, visit_ad_clicks.ad_click_id))
		.innerJoin(campaign_visits, eq(campaign_visits.id, visit_ad_clicks.campaign_visit_id))
		.where(
			and(
				inArray(visit_ad_clicks.campaign_visit_id, visitIds),
				lte(ad_clicks.captured_at, before),
				lte(visit_ad_clicks.observed_at, before),
				eq(campaign_visits.campaign_id, journey.campaign_id ?? journey.first_campaign_id ?? -1)
			)
		)
		.orderBy(desc(ad_clicks.captured_at), desc(ad_clicks.id));

	// Preserve existing cookie attribution for known journey visitors. This fallback is
	// never used by the exact-visit endpoint and never reconstructs visit provenance.
	const visitors = await db
		.select({ id: campaign_visits.ip_hash_or_session_identifier })
		.from(campaign_visits)
		.where(inArray(campaign_visits.id, visitIds));
	const visitorIds = visitors.map((v) => v.id).filter((v): v is string => Boolean(v));
	const legacy = visitorIds.length
		? await db
				.select()
				.from(ad_clicks)
				.where(
					and(
						inArray(ad_clicks.visitor_id, visitorIds),
						eq(ad_clicks.campaign_id, journey.campaign_id ?? journey.first_campaign_id ?? -1),
						lte(ad_clicks.captured_at, before)
					)
				)
		: [];
	const unique = [
		...new Map([...clicks.map((row) => row.click), ...legacy].map((c) => [c.id, c])).values()
	];
	unique.sort(
		(a, b) => b.captured_at.getTime() - a.captured_at.getTime() || b.id.localeCompare(a.id)
	);
	return { journey, clicks: unique };
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
