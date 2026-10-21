import type { ConsentSettings } from '$lib/tracking/contract';
import { db } from '$lib/server/db';
import {
	campaign_visits,
	campaign_pages,
	page_artifacts,
	visit_ad_consent
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getTrackingConfig } from './config';

// Resolve the visit's pinned runtime, including unpublished historical versions.
export async function visitConsentPolicy(visitId: number) {
	const [page] = await db
		.select({ campaignId: campaign_visits.campaign_id, runtime: page_artifacts.runtime_version })
		.from(campaign_visits)
		.leftJoin(page_artifacts, eq(page_artifacts.campaign_page_id, campaign_visits.campaign_page_id))
		.where(eq(campaign_visits.id, visitId))
		.limit(1);
	if (page?.runtime !== 'v6') return null;
	return (await getTrackingConfig(page.campaignId)).consent;
}

export async function effectiveVisitConsent(
	visitId: number,
	record: typeof visit_ad_consent.$inferSelect | undefined
) {
	return evaluateConsent(record, await visitConsentPolicy(visitId));
}
export function evaluateConsent(
	record: typeof visit_ad_consent.$inferSelect | undefined,
	policy: ConsentSettings | null
) {
	const current =
		record &&
		(!policy ||
			(record.policy_version === policy.policyVersion &&
				(record.expires_at?.getTime() ?? 0) > Date.now() &&
				record.recorded_at.getTime() + policy.retentionDays * 86400000 > Date.now()));
	return {
		adUserDataConsent: current ? record.ad_user_data : (policy?.missingOfflineConsent ?? 'GRANTED'),
		source: current ? ('visitor_record' as const) : ('owner_default' as const),
		recordedAt: current ? record.recorded_at : null,
		policyVersion: current ? record.policy_version : (policy?.policyVersion ?? null)
	};
}

// Measurement endpoints also need a policy before a visit has been established.
export async function pageConsentPolicy(pageId: number) {
	const [page] = await db
		.select({ campaignId: campaign_pages.campaign_id, runtime: page_artifacts.runtime_version })
		.from(campaign_pages)
		.innerJoin(page_artifacts, eq(page_artifacts.campaign_page_id, campaign_pages.id))
		.where(eq(campaign_pages.id, pageId))
		.limit(1);
	return page?.runtime === 'v6' ? (await getTrackingConfig(page.campaignId)).consent : null;
}
