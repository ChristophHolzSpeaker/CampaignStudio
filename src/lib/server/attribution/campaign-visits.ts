import { db } from '$lib/server/db';
import { campaign_visits } from '$lib/server/db/schema';
import type { Cookies } from '@sveltejs/kit';
import { and, eq, gte } from 'drizzle-orm';

const VISITOR_COOKIE_NAME = 'cs_vid';
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const VISIT_DEDUPE_WINDOW_MINUTES = 30;

function readUtm(searchParams: URLSearchParams, key: string): string | null {
	const value = searchParams.get(key);
	return value && value.trim().length > 0 ? value.trim() : null;
}

export function getOrCreateVisitorIdentifier(input: {
	cookies: Cookies;
	secureCookie: boolean;
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
		maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS
	});

	return created;
}

export async function logCampaignVisit(input: {
	campaignId: number;
	campaignPageId: number;
	slug: string;
	searchParams: URLSearchParams;
	headers: Headers;
	visitorIdentifier: string;
}): Promise<{ logged: boolean }> {
	const dedupeWindowStart = new Date(Date.now() - VISIT_DEDUPE_WINDOW_MINUTES * 60 * 1000);

	const [existingVisit] = await db
		.select({ id: campaign_visits.id })
		.from(campaign_visits)
		.where(
			and(
				eq(campaign_visits.campaign_id, input.campaignId),
				eq(campaign_visits.campaign_page_id, input.campaignPageId),
				eq(campaign_visits.ip_hash_or_session_identifier, input.visitorIdentifier),
				gte(campaign_visits.visited_at, dedupeWindowStart)
			)
		)
		.limit(1);

	if (existingVisit) {
		return { logged: false };
	}

	await db.insert(campaign_visits).values({
		campaign_id: input.campaignId,
		campaign_page_id: input.campaignPageId,
		slug: input.slug,
		referrer: input.headers.get('referer'),
		utm_source: readUtm(input.searchParams, 'utm_source'),
		utm_medium: readUtm(input.searchParams, 'utm_medium'),
		utm_campaign: readUtm(input.searchParams, 'utm_campaign'),
		utm_term: readUtm(input.searchParams, 'utm_term'),
		utm_content: readUtm(input.searchParams, 'utm_content'),
		user_agent: input.headers.get('user-agent'),
		ip_hash_or_session_identifier: input.visitorIdentifier
	});

	return { logged: true };
}
