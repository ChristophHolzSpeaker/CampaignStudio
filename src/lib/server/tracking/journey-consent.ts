import { evaluateConsent } from './consent-policy';
import { getTrackingConfig } from './config';
import { and, eq, inArray, lte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	campaign_visits,
	lead_events,
	lead_journeys,
	visit_ad_consent,
	page_artifacts
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
	const fallback = async () => {
		const pageId = journey.campaign_page_id ?? journey.first_page_id ?? journey.last_page_id;
		const [page] = pageId
			? await db
					.select({ runtime: page_artifacts.runtime_version })
					.from(page_artifacts)
					.where(eq(page_artifacts.campaign_page_id, pageId))
					.limit(1)
			: [];
		const consent =
			page?.runtime === 'v6'
				? (await getTrackingConfig(journey.campaign_id ?? journey.first_campaign_id ?? -1)).consent
				: null;
		return {
			denied: consent?.missingOfflineConsent === 'DENIED',
			source: 'owner_default' as const
		};
	};
	if (!ids.length) return fallback();
	const rows = await db
		.select({ runtime: page_artifacts.runtime_version, record: visit_ad_consent })
		.from(campaign_visits)
		.leftJoin(visit_ad_consent, eq(campaign_visits.id, visit_ad_consent.campaign_visit_id))
		.leftJoin(page_artifacts, eq(page_artifacts.campaign_page_id, campaign_visits.campaign_page_id))
		.where(
			and(
				inArray(campaign_visits.id, ids),
				lte(campaign_visits.visited_at, before),
				eq(campaign_visits.campaign_id, journey.campaign_id ?? journey.first_campaign_id ?? -1)
			)
		);
	if (!rows.length) return fallback();
	const policy = rows.some((row) => row.runtime === 'v6')
		? (await getTrackingConfig(journey.campaign_id ?? journey.first_campaign_id ?? -1)).consent
		: null;
	const decisions = rows.map((row) =>
		evaluateConsent(row.record ?? undefined, row.runtime === 'v6' ? policy : null)
	);
	return {
		denied: decisions.some((decision) => decision.adUserDataConsent !== 'GRANTED'),
		source: decisions.some((decision) => decision.source === 'visitor_record')
			? ('visitor_record' as const)
			: ('owner_default' as const)
	};
}
