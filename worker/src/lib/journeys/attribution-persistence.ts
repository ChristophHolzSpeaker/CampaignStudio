import { selectOne, updateMany } from '../db';
import type { WorkerEnv } from '../env';

const ATTRIBUTION_MODEL_VERSION = 'journey_attribution_v1';

type JourneyAttributionStateRow = {
	id: string;
	first_seen_at: string | null;
	first_visit_id: number | null;
	first_campaign_id: number | null;
	first_page_id: number | null;
	first_utm_source: string | null;
	first_utm_medium: string | null;
	first_utm_campaign: string | null;
	first_referrer: string | null;
	first_cta_key: string | null;
	last_seen_at: string | null;
	last_visit_id: number | null;
	last_campaign_id: number | null;
	last_page_id: number | null;
	last_utm_source: string | null;
	last_utm_medium: string | null;
	last_utm_campaign: string | null;
	last_referrer: string | null;
	last_cta_key: string | null;
	attribution_model_version: string;
};

type VisitAttributionRow = {
	id: number;
	campaign_id: number;
	campaign_page_id: number | null;
	utm_source: string | null;
	utm_medium: string | null;
	utm_campaign: string | null;
	referrer: string | null;
	visited_at: string;
};

type CtaEventRow = {
	cta_key: string | null;
};

export async function persistWorkerJourneyAttributionSnapshot(
	env: WorkerEnv,
	input: {
		journeyId: string;
		campaignId: number | null;
		campaignPageId: number | null;
		observedAt?: Date;
		visitorIdentifier?: string | null;
	}
): Promise<void> {
	const observedAtIso = (input.observedAt ?? new Date()).toISOString();

	const journeyQuery = new URLSearchParams({
		select:
			'id,first_seen_at,first_visit_id,first_campaign_id,first_page_id,first_utm_source,first_utm_medium,first_utm_campaign,first_referrer,first_cta_key,last_seen_at,last_visit_id,last_campaign_id,last_page_id,last_utm_source,last_utm_medium,last_utm_campaign,last_referrer,last_cta_key,attribution_model_version',
		id: `eq.${input.journeyId}`,
		limit: '1'
	});

	const journey = await selectOne<JourneyAttributionStateRow>(env, 'lead_journeys', journeyQuery);
	if (!journey) {
		return;
	}

	let firstVisit: VisitAttributionRow | null = null;
	let lastVisit: VisitAttributionRow | null = null;

	if (input.visitorIdentifier && input.campaignId !== null) {
		const baseQuery: Record<string, string> = {
			select:
				'id,campaign_id,campaign_page_id,utm_source,utm_medium,utm_campaign,referrer,visited_at',
			ip_hash_or_session_identifier: `eq.${input.visitorIdentifier}`,
			campaign_id: `eq.${input.campaignId}`,
			visited_at: `lte.${observedAtIso}`,
			limit: '1'
		};

		const firstQuery = new URLSearchParams({
			...baseQuery,
			order: 'visited_at.asc,id.asc'
		});
		const lastQuery = new URLSearchParams({
			...baseQuery,
			order: 'visited_at.desc,id.desc'
		});

		[firstVisit, lastVisit] = await Promise.all([
			selectOne<VisitAttributionRow>(env, 'campaign_visits', firstQuery),
			selectOne<VisitAttributionRow>(env, 'campaign_visits', lastQuery)
		]);
	}

	const ctaBase = new URLSearchParams({
		select: 'cta_key',
		lead_journey_id: `eq.${input.journeyId}`,
		cta_key: 'not.is.null',
		occurred_at: `lte.${observedAtIso}`,
		limit: '1'
	});

	const [firstCta, lastCta] = await Promise.all([
		selectOne<CtaEventRow>(
			env,
			'lead_events',
			new URLSearchParams({ ...Object.fromEntries(ctaBase), order: 'occurred_at.asc,id.asc' })
		),
		selectOne<CtaEventRow>(
			env,
			'lead_events',
			new URLSearchParams({ ...Object.fromEntries(ctaBase), order: 'occurred_at.desc,id.desc' })
		)
	]);

	const firstCandidate = {
		visit_id: firstVisit?.id ?? null,
		campaign_id: firstVisit?.campaign_id ?? input.campaignId,
		page_id: firstVisit?.campaign_page_id ?? input.campaignPageId,
		utm_source: firstVisit?.utm_source ?? null,
		utm_medium: firstVisit?.utm_medium ?? null,
		utm_campaign: firstVisit?.utm_campaign ?? null,
		referrer: firstVisit?.referrer ?? null,
		cta_key: firstCta?.cta_key ?? null,
		seen_at: firstVisit?.visited_at ?? observedAtIso
	};

	const lastCandidate = {
		visit_id: lastVisit?.id ?? null,
		campaign_id: lastVisit?.campaign_id ?? input.campaignId,
		page_id: lastVisit?.campaign_page_id ?? input.campaignPageId,
		utm_source: lastVisit?.utm_source ?? null,
		utm_medium: lastVisit?.utm_medium ?? null,
		utm_campaign: lastVisit?.utm_campaign ?? null,
		referrer: lastVisit?.referrer ?? null,
		cta_key: lastCta?.cta_key ?? null,
		seen_at: lastVisit?.visited_at ?? observedAtIso
	};

	const shouldSetFirst =
		journey.first_seen_at === null
			? true
			: firstCandidate.visit_id !== null && firstCandidate.seen_at < journey.first_seen_at;
	const shouldSetLast =
		journey.last_seen_at === null || lastCandidate.seen_at > journey.last_seen_at;

	if (
		!shouldSetFirst &&
		!shouldSetLast &&
		journey.attribution_model_version === ATTRIBUTION_MODEL_VERSION
	) {
		return;
	}

	const updateQuery = new URLSearchParams({
		select: 'id',
		id: `eq.${input.journeyId}`,
		limit: '1'
	});

	await updateMany(env, 'lead_journeys', updateQuery, {
		first_visit_id: shouldSetFirst ? firstCandidate.visit_id : journey.first_visit_id,
		first_campaign_id: shouldSetFirst ? firstCandidate.campaign_id : journey.first_campaign_id,
		first_page_id: shouldSetFirst ? firstCandidate.page_id : journey.first_page_id,
		first_utm_source: shouldSetFirst ? firstCandidate.utm_source : journey.first_utm_source,
		first_utm_medium: shouldSetFirst ? firstCandidate.utm_medium : journey.first_utm_medium,
		first_utm_campaign: shouldSetFirst ? firstCandidate.utm_campaign : journey.first_utm_campaign,
		first_referrer: shouldSetFirst ? firstCandidate.referrer : journey.first_referrer,
		first_cta_key: shouldSetFirst ? firstCandidate.cta_key : journey.first_cta_key,
		first_seen_at: shouldSetFirst ? firstCandidate.seen_at : journey.first_seen_at,
		last_visit_id: shouldSetLast ? lastCandidate.visit_id : journey.last_visit_id,
		last_campaign_id: shouldSetLast ? lastCandidate.campaign_id : journey.last_campaign_id,
		last_page_id: shouldSetLast ? lastCandidate.page_id : journey.last_page_id,
		last_utm_source:
			shouldSetLast && lastCandidate.visit_id !== null
				? lastCandidate.utm_source
				: journey.last_utm_source,
		last_utm_medium:
			shouldSetLast && lastCandidate.visit_id !== null
				? lastCandidate.utm_medium
				: journey.last_utm_medium,
		last_utm_campaign:
			shouldSetLast && lastCandidate.visit_id !== null
				? lastCandidate.utm_campaign
				: journey.last_utm_campaign,
		last_referrer:
			shouldSetLast && lastCandidate.visit_id !== null
				? lastCandidate.referrer
				: journey.last_referrer,
		last_cta_key: shouldSetLast
			? (lastCandidate.cta_key ?? journey.last_cta_key)
			: journey.last_cta_key,
		last_seen_at: shouldSetLast ? lastCandidate.seen_at : journey.last_seen_at,
		attribution_model_version: ATTRIBUTION_MODEL_VERSION,
		updated_at: observedAtIso
	});
}
