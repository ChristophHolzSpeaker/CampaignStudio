import { OutcomeError } from '$lib/server/tracking/errors';
import { captureAdClicks } from '$lib/server/tracking/attribution';
import { db } from '$lib/server/db';
import { campaign_visits } from '$lib/server/db/schema';
import type { Cookies } from '@sveltejs/kit';
import { and, desc, eq, gte, lte, isNull, or } from 'drizzle-orm';

const VISITOR_COOKIE_NAME = 'cs_vid';
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const VISIT_DEDUPE_WINDOW_MINUTES = 30;

function readUtm(searchParams: URLSearchParams, key: string): string | null {
	const value = searchParams.get(key);
	return value && value.trim().length > 0 ? value.trim() : null;
}

function readHeader(headers: Headers, key: string): string | null {
	const value = headers.get(key)?.trim();
	return value && value.length > 0 ? value : null;
}

function readFirstForwardedIp(headers: Headers): string | null {
	const forwardedFor = readHeader(headers, 'x-forwarded-for');
	if (forwardedFor) {
		const [firstIp] = forwardedFor.split(',');
		const trimmed = firstIp?.trim();
		if (trimmed) {
			return trimmed;
		}
	}

	return readHeader(headers, 'x-real-ip');
}

function readVercelGeoHeader(headers: Headers, key: string): string | null {
	const value = readHeader(headers, key);
	if (!value) {
		return null;
	}

	try {
		return decodeURIComponent(value.replaceAll('+', ' '));
	} catch {
		return value;
	}
}

export function getOrCreateVisitorIdentifier(input: {
	cookies: Cookies;
	secureCookie: boolean;
	maxAge?: number;
}): string {
	const existing = input.cookies.get(VISITOR_COOKIE_NAME);
	if (existing) {
		return existing;
	}

	const created = crypto.randomUUID();
	input.cookies.set(VISITOR_COOKIE_NAME, created, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: input.secureCookie,
		maxAge: input.maxAge ?? VISITOR_COOKIE_MAX_AGE_SECONDS
	});

	return created;
}

export function readVisitorIdentifier(cookies: Cookies): string | null {
	return cookies.get(VISITOR_COOKIE_NAME) ?? null;
}

export async function resolveCampaignVisitId(input: {
	campaignId: number;
	campaignPageId: number;
	visitorIdentifier: string | null;
	requestedVisitId?: number | null;
	observedAt?: Date;
}): Promise<number | null> {
	if (!input.visitorIdentifier) {
		return null;
	}

	const ownershipWhere = and(
		eq(campaign_visits.campaign_id, input.campaignId),
		eq(campaign_visits.campaign_page_id, input.campaignPageId),
		eq(campaign_visits.ip_hash_or_session_identifier, input.visitorIdentifier),
		lte(campaign_visits.visited_at, input.observedAt ?? new Date())
	);
	const where = input.requestedVisitId
		? and(ownershipWhere, eq(campaign_visits.id, input.requestedVisitId))
		: ownershipWhere;

	const [visit] = await db
		.select({ id: campaign_visits.id })
		.from(campaign_visits)
		.where(where)
		.orderBy(desc(campaign_visits.visited_at), desc(campaign_visits.id))
		.limit(1);

	return visit?.id ?? null;
}

export async function logCampaignVisit(input: {
	campaignId: number;
	campaignPageId: number;
	slug: string;
	searchParams: URLSearchParams;
	headers: Headers;
	visitorIdentifier: string | null;
	// Only supplied after verification of the page-scoped receipt.
	receiptVisitId?: number;
	consentOnly?: boolean;
	captureAds?: boolean;
}): Promise<{ logged: boolean; visitId: number | null }> {
	const captureAds = input.visitorIdentifier !== null && (input.captureAds ?? !input.consentOnly);
	const measurement = input.consentOnly
		? {}
		: {
				referrer: input.visitorIdentifier ? input.headers.get('referer') : null,
				utm_source: readUtm(input.searchParams, 'utm_source'),
				utm_medium: readUtm(input.searchParams, 'utm_medium'),
				utm_campaign: readUtm(input.searchParams, 'utm_campaign'),
				utm_term: readUtm(input.searchParams, 'utm_term'),
				utm_content: readUtm(input.searchParams, 'utm_content'),
				user_agent: input.visitorIdentifier ? input.headers.get('user-agent') : null,
				ip_address: readFirstForwardedIp(input.headers),
				country: readVercelGeoHeader(input.headers, 'x-vercel-ip-country'),
				city: input.visitorIdentifier
					? readVercelGeoHeader(input.headers, 'x-vercel-ip-city')
					: null
			};
	// page_view source of truth: we intentionally model page views in campaign_visits
	// (deduped by visitor and time window) instead of duplicating every view into lead_events.
	const dedupeWindowStart = new Date(Date.now() - VISIT_DEDUPE_WINDOW_MINUTES * 60 * 1000);

	const [existingVisit] =
		input.visitorIdentifier === null
			? []
			: await db
					.select({ id: campaign_visits.id, consentOnly: campaign_visits.is_consent_only })
					.from(campaign_visits)
					.where(
						and(
							eq(campaign_visits.campaign_id, input.campaignId),
							eq(campaign_visits.campaign_page_id, input.campaignPageId),
							input.receiptVisitId
								? and(
										eq(campaign_visits.id, input.receiptVisitId),
										or(
											isNull(campaign_visits.ip_hash_or_session_identifier),
											eq(campaign_visits.ip_hash_or_session_identifier, input.visitorIdentifier)
										)
									)
								: eq(campaign_visits.ip_hash_or_session_identifier, input.visitorIdentifier),
							gte(campaign_visits.visited_at, dedupeWindowStart)
						)
					)
					.limit(1);

	if (input.receiptVisitId && !existingVisit)
		throw new OutcomeError(409, 'Visit receipt is no longer claimable');
	if (existingVisit) {
		if (input.receiptVisitId) {
			const [claimed] = await db
				.update(campaign_visits)
				.set({
					ip_hash_or_session_identifier: input.visitorIdentifier,
					...(!input.consentOnly ? measurement : {})
				})
				.where(
					and(
						eq(campaign_visits.id, existingVisit.id),
						or(
							isNull(campaign_visits.ip_hash_or_session_identifier),
							eq(campaign_visits.ip_hash_or_session_identifier, input.visitorIdentifier!)
						)
					)
				)
				.returning({ id: campaign_visits.id });
			if (!claimed) throw new OutcomeError(409, 'Visit receipt is no longer claimable');
		}
		if (existingVisit.consentOnly && !input.consentOnly) {
			await db
				.update(campaign_visits)
				.set({ ...measurement, is_consent_only: false })
				.where(
					and(eq(campaign_visits.id, existingVisit.id), eq(campaign_visits.is_consent_only, true))
				);
		}
		if (captureAds)
			await captureAdClicks({
				...input,
				visitorIdentifier: input.visitorIdentifier!,
				visitId: existingVisit.id
			});
		return { logged: false, visitId: existingVisit.id };
	}

	const [createdVisit] = await db
		.insert(campaign_visits)
		.values({
			campaign_id: input.campaignId,
			campaign_page_id: input.campaignPageId,
			slug: input.slug,
			is_consent_only: Boolean(input.consentOnly),
			...measurement,
			ip_hash_or_session_identifier: input.visitorIdentifier
		})
		.returning({ id: campaign_visits.id });

	if (createdVisit && captureAds)
		await captureAdClicks({
			...input,
			visitorIdentifier: input.visitorIdentifier!,
			visitId: createdVisit.id
		});
	return { logged: true, visitId: createdVisit?.id ?? null };
}

export async function markCampaignVisitEngaged(input: {
	visitId: number;
	visitorIdentifier: string;
	durationMs: number;
}): Promise<{ marked: boolean }> {
	const durationMs = Math.max(0, Math.floor(input.durationMs));
	const [updatedVisit] = await db
		.update(campaign_visits)
		.set({
			bounced: false,
			engaged_at: new Date(),
			engagement_duration_ms: durationMs
		})
		.where(
			and(
				eq(campaign_visits.id, input.visitId),
				eq(campaign_visits.ip_hash_or_session_identifier, input.visitorIdentifier)
			)
		)
		.returning({ id: campaign_visits.id });

	return { marked: Boolean(updatedVisit) };
}
