import { db } from '$lib/server/db';
import { campaign_visits, lead_events, lead_journeys } from '$lib/server/db/schema';
import { and, asc, desc, eq, isNotNull, lte } from 'drizzle-orm';

const ATTRIBUTION_MODEL_VERSION = 'journey_attribution_v1';

type AttributionSnapshot = {
	visitId: number | null;
	campaignId: number | null;
	pageId: number | null;
	utmSource: string | null;
	utmMedium: string | null;
	utmCampaign: string | null;
	referrer: string | null;
	ctaKey: string | null;
	seenAt: Date;
};

type VisitAttributionRow = {
	visitId: number;
	campaignId: number;
	pageId: number | null;
	utmSource: string | null;
	utmMedium: string | null;
	utmCampaign: string | null;
	referrer: string | null;
	visitedAt: Date;
};

export type JourneyAttributionState = {
	first_visit_id: number | null;
	first_campaign_id: number | null;
	first_page_id: number | null;
	first_utm_source: string | null;
	first_utm_medium: string | null;
	first_utm_campaign: string | null;
	first_referrer: string | null;
	first_cta_key: string | null;
	first_seen_at: Date | null;
	last_visit_id: number | null;
	last_campaign_id: number | null;
	last_page_id: number | null;
	last_utm_source: string | null;
	last_utm_medium: string | null;
	last_utm_campaign: string | null;
	last_referrer: string | null;
	last_cta_key: string | null;
	last_seen_at: Date | null;
	attribution_model_version: string;
};

export type JourneyAttributionUpdate = {
	first_visit_id: number | null;
	first_campaign_id: number | null;
	first_page_id: number | null;
	first_utm_source: string | null;
	first_utm_medium: string | null;
	first_utm_campaign: string | null;
	first_referrer: string | null;
	first_cta_key: string | null;
	first_seen_at: Date | null;
	last_visit_id: number | null;
	last_campaign_id: number | null;
	last_page_id: number | null;
	last_utm_source: string | null;
	last_utm_medium: string | null;
	last_utm_campaign: string | null;
	last_referrer: string | null;
	last_cta_key: string | null;
	last_seen_at: Date | null;
	attribution_model_version: string;
	updated_at: Date;
};

function toSnapshotFromVisit(input: {
	visit: VisitAttributionRow;
	ctaKey: string | null;
}): AttributionSnapshot {
	return {
		visitId: input.visit.visitId,
		campaignId: input.visit.campaignId,
		pageId: input.visit.pageId,
		utmSource: input.visit.utmSource,
		utmMedium: input.visit.utmMedium,
		utmCampaign: input.visit.utmCampaign,
		referrer: input.visit.referrer,
		ctaKey: input.ctaKey,
		seenAt: input.visit.visitedAt
	};
}

function toFallbackSnapshot(input: {
	campaignId: number | null;
	pageId: number | null;
	ctaKey: string | null;
	seenAt: Date;
}): AttributionSnapshot {
	return {
		visitId: null,
		campaignId: input.campaignId,
		pageId: input.pageId,
		utmSource: null,
		utmMedium: null,
		utmCampaign: null,
		referrer: null,
		ctaKey: input.ctaKey,
		seenAt: input.seenAt
	};
}

async function getVisitCandidates(input: {
	visitorIdentifier: string | null;
	campaignId: number | null;
	observedAt: Date;
}): Promise<{ first: VisitAttributionRow | null; last: VisitAttributionRow | null }> {
	if (!input.visitorIdentifier || input.campaignId === null) {
		return { first: null, last: null };
	}

	const where = and(
		eq(campaign_visits.ip_hash_or_session_identifier, input.visitorIdentifier),
		eq(campaign_visits.campaign_id, input.campaignId),
		lte(campaign_visits.visited_at, input.observedAt)
	);

	const [first] = await db
		.select({
			visitId: campaign_visits.id,
			campaignId: campaign_visits.campaign_id,
			pageId: campaign_visits.campaign_page_id,
			utmSource: campaign_visits.utm_source,
			utmMedium: campaign_visits.utm_medium,
			utmCampaign: campaign_visits.utm_campaign,
			referrer: campaign_visits.referrer,
			visitedAt: campaign_visits.visited_at
		})
		.from(campaign_visits)
		.where(where)
		.orderBy(asc(campaign_visits.visited_at), asc(campaign_visits.id))
		.limit(1);

	const [last] = await db
		.select({
			visitId: campaign_visits.id,
			campaignId: campaign_visits.campaign_id,
			pageId: campaign_visits.campaign_page_id,
			utmSource: campaign_visits.utm_source,
			utmMedium: campaign_visits.utm_medium,
			utmCampaign: campaign_visits.utm_campaign,
			referrer: campaign_visits.referrer,
			visitedAt: campaign_visits.visited_at
		})
		.from(campaign_visits)
		.where(where)
		.orderBy(desc(campaign_visits.visited_at), desc(campaign_visits.id))
		.limit(1);

	return {
		first: first ?? null,
		last: last ?? null
	};
}

async function getJourneyCtaCandidates(input: {
	journeyId: string;
	observedAt: Date;
}): Promise<{ firstCtaKey: string | null; lastCtaKey: string | null }> {
	const baseWhere = and(
		eq(lead_events.lead_journey_id, input.journeyId),
		isNotNull(lead_events.cta_key),
		lte(lead_events.occurred_at, input.observedAt)
	);

	const [first] = await db
		.select({ ctaKey: lead_events.cta_key })
		.from(lead_events)
		.where(baseWhere)
		.orderBy(asc(lead_events.occurred_at), asc(lead_events.id))
		.limit(1);

	const [last] = await db
		.select({ ctaKey: lead_events.cta_key })
		.from(lead_events)
		.where(baseWhere)
		.orderBy(desc(lead_events.occurred_at), desc(lead_events.id))
		.limit(1);

	return {
		firstCtaKey: first?.ctaKey ?? null,
		lastCtaKey: last?.ctaKey ?? null
	};
}

export function deriveJourneyAttributionUpdate(input: {
	journey: JourneyAttributionState;
	firstCandidate: AttributionSnapshot;
	lastCandidate: AttributionSnapshot;
	observedAt: Date;
}): JourneyAttributionUpdate | null {
	const shouldSetFirst =
		input.journey.first_seen_at === null
			? true
			: input.firstCandidate.visitId !== null &&
				input.firstCandidate.seenAt < input.journey.first_seen_at;

	const shouldSetLast =
		input.journey.last_seen_at === null || input.lastCandidate.seenAt > input.journey.last_seen_at;

	if (
		!shouldSetFirst &&
		!shouldSetLast &&
		input.journey.attribution_model_version === ATTRIBUTION_MODEL_VERSION
	) {
		return null;
	}

	return {
		first_visit_id: shouldSetFirst ? input.firstCandidate.visitId : input.journey.first_visit_id,
		first_campaign_id: shouldSetFirst
			? input.firstCandidate.campaignId
			: input.journey.first_campaign_id,
		first_page_id: shouldSetFirst ? input.firstCandidate.pageId : input.journey.first_page_id,
		first_utm_source: shouldSetFirst
			? input.firstCandidate.utmSource
			: input.journey.first_utm_source,
		first_utm_medium: shouldSetFirst
			? input.firstCandidate.utmMedium
			: input.journey.first_utm_medium,
		first_utm_campaign: shouldSetFirst
			? input.firstCandidate.utmCampaign
			: input.journey.first_utm_campaign,
		first_referrer: shouldSetFirst ? input.firstCandidate.referrer : input.journey.first_referrer,
		first_cta_key: shouldSetFirst ? input.firstCandidate.ctaKey : input.journey.first_cta_key,
		first_seen_at: shouldSetFirst ? input.firstCandidate.seenAt : input.journey.first_seen_at,
		last_visit_id: shouldSetLast ? input.lastCandidate.visitId : input.journey.last_visit_id,
		last_campaign_id: shouldSetLast
			? input.lastCandidate.campaignId
			: input.journey.last_campaign_id,
		last_page_id: shouldSetLast ? input.lastCandidate.pageId : input.journey.last_page_id,
		last_utm_source:
			shouldSetLast && input.lastCandidate.visitId !== null
				? input.lastCandidate.utmSource
				: input.journey.last_utm_source,
		last_utm_medium:
			shouldSetLast && input.lastCandidate.visitId !== null
				? input.lastCandidate.utmMedium
				: input.journey.last_utm_medium,
		last_utm_campaign:
			shouldSetLast && input.lastCandidate.visitId !== null
				? input.lastCandidate.utmCampaign
				: input.journey.last_utm_campaign,
		last_referrer:
			shouldSetLast && input.lastCandidate.visitId !== null
				? input.lastCandidate.referrer
				: input.journey.last_referrer,
		last_cta_key: shouldSetLast
			? (input.lastCandidate.ctaKey ?? input.journey.last_cta_key)
			: input.journey.last_cta_key,
		last_seen_at: shouldSetLast ? input.lastCandidate.seenAt : input.journey.last_seen_at,
		attribution_model_version: ATTRIBUTION_MODEL_VERSION,
		updated_at: input.observedAt
	};
}

export async function persistJourneyAttributionSnapshot(input: {
	journeyId: string;
	campaignId: number | null;
	campaignPageId: number | null;
	visitorIdentifier?: string | null;
	observedAt?: Date;
}): Promise<void> {
	const observedAt = input.observedAt ?? new Date();

	const [journey] = await db
		.select()
		.from(lead_journeys)
		.where(eq(lead_journeys.id, input.journeyId))
		.limit(1);

	if (!journey) {
		return;
	}

	const [{ first, last }, ctaCandidates] = await Promise.all([
		getVisitCandidates({
			visitorIdentifier: input.visitorIdentifier ?? null,
			campaignId: input.campaignId,
			observedAt
		}),
		getJourneyCtaCandidates({
			journeyId: input.journeyId,
			observedAt
		})
	]);

	const firstCandidate = first
		? toSnapshotFromVisit({ visit: first, ctaKey: ctaCandidates.firstCtaKey })
		: toFallbackSnapshot({
				campaignId: input.campaignId,
				pageId: input.campaignPageId,
				ctaKey: ctaCandidates.firstCtaKey,
				seenAt: observedAt
			});

	const lastCandidate = last
		? toSnapshotFromVisit({ visit: last, ctaKey: ctaCandidates.lastCtaKey })
		: toFallbackSnapshot({
				campaignId: input.campaignId,
				pageId: input.campaignPageId,
				ctaKey: ctaCandidates.lastCtaKey,
				seenAt: observedAt
			});

	const updateValues = deriveJourneyAttributionUpdate({
		journey,
		firstCandidate,
		lastCandidate,
		observedAt
	});

	if (!updateValues) {
		return;
	}

	await db.update(lead_journeys).set(updateValues).where(eq(lead_journeys.id, input.journeyId));
}
