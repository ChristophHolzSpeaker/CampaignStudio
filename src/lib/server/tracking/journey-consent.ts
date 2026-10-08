import { and, eq, inArray, lte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	campaign_visits,
	lead_events,
	lead_journeys,
	visit_ad_consent
} from '$lib/server/db/schema';

// Denial wins across the journey's verified visits. No visitor evidence is fabricated.
export async function journeyConsent(journeyId: string, before = new Date()) {
	const [journey] = await db
		.select()
		.from(lead_journeys)
		.where(eq(lead_journeys.id, journeyId))
		.limit(1);
	if (!journey) return { denied: false, source: 'owner_default' as const };
	const linked = await db
		.select({ id: lead_events.campaign_visit_id })
		.from(lead_events)
		.where(and(eq(lead_events.lead_journey_id, journeyId), lte(lead_events.occurred_at, before)));
	const ids = [
		journey.first_visit_id,
		journey.last_visit_id,
		...linked.map((row) => row.id)
	].filter((id): id is number => id !== null);
	if (!ids.length) return { denied: false, source: 'owner_default' as const };
	const rows = await db
		.select({ value: visit_ad_consent.ad_user_data })
		.from(visit_ad_consent)
		.innerJoin(campaign_visits, eq(campaign_visits.id, visit_ad_consent.campaign_visit_id))
		.where(
			and(
				inArray(campaign_visits.id, ids),
				lte(campaign_visits.visited_at, before),
				eq(campaign_visits.campaign_id, journey.campaign_id ?? journey.first_campaign_id ?? -1)
			)
		);
	return {
		denied: rows.some((row) => row.value !== 'GRANTED'),
		source: rows.length ? ('visitor_record' as const) : ('owner_default' as const)
	};
}
