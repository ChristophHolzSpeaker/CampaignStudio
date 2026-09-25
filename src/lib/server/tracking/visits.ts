import { and, desc, eq, lte } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import {
	ad_clicks,
	campaign_visits,
	visit_ad_clicks,
	visit_ad_consent,
	tracking_events,
	conversion_deliveries
} from '$lib/server/db/schema';
import {
	findMapping,
	type visitConsentSchema,
	type visitTrackingQuerySchema
} from '$lib/tracking/contract';
import type { z } from 'zod';
import { getTrackingConfig } from './config';
import { googleConfigured } from './google';
import { OutcomeError } from './errors';

export async function visitAttribution(visitId: number, before = new Date()) {
	const [visit] = await db
		.select()
		.from(campaign_visits)
		.where(eq(campaign_visits.id, visitId))
		.limit(1);
	if (!visit) return null;
	const clicks = await db
		.select({ click: ad_clicks })
		.from(visit_ad_clicks)
		.innerJoin(ad_clicks, eq(ad_clicks.id, visit_ad_clicks.ad_click_id))
		.where(
			and(
				eq(visit_ad_clicks.campaign_visit_id, visitId),
				lte(visit_ad_clicks.observed_at, before),
				lte(ad_clicks.captured_at, before)
			)
		)
		.orderBy(desc(ad_clicks.captured_at), desc(ad_clicks.id));
	const [consent] = await db
		.select()
		.from(visit_ad_consent)
		.where(eq(visit_ad_consent.campaign_visit_id, visitId));
	return { visit, clicks: clicks.map((c) => c.click), consent };
}

export function consentBlock(
	consent: typeof visit_ad_consent.$inferSelect | undefined
): string | null {
	if (!consent) return null; // Owner-selected default, not a visitor consent record.
	return consent.ad_user_data === 'GRANTED' ? null : 'consent_denied';
}

export async function recordVisitConsent(
	visitId: number,
	input: z.infer<typeof visitConsentSchema>,
	owner: { visitorIdentifier: string; campaignPageId: number }
) {
	// Require the owning browser cookie; a CRM bearer token cannot manufacture visitor consent.
	const [visit] = await db
		.select({ id: campaign_visits.id })
		.from(campaign_visits)
		.where(
			and(
				eq(campaign_visits.id, visitId),
				eq(campaign_visits.campaign_page_id, owner.campaignPageId),
				eq(campaign_visits.ip_hash_or_session_identifier, owner.visitorIdentifier)
			)
		)
		.limit(1);
	if (!visit) throw new OutcomeError(404, 'Visit not found');
	const values = {
		campaign_visit_id: visitId,
		ad_user_data: input.adUserDataConsent,
		evidence_ref: input.evidenceRef,
		policy_version: input.policyVersion,
		recorded_at: new Date()
	};
	const [row] = await db
		.insert(visit_ad_consent)
		.values(values)
		.onConflictDoUpdate({ target: visit_ad_consent.campaign_visit_id, set: values })
		.returning();
	return {
		adUserDataConsent: row.ad_user_data,
		recordedAt: row.recorded_at,
		policyVersion: row.policy_version
	};
}

export async function visitReadiness(
	visitId: number,
	query: z.infer<typeof visitTrackingQuerySchema>
) {
	const before = query.occurredAt ? new Date(query.occurredAt) : new Date();
	const attribution = await visitAttribution(visitId, before);
	if (!attribution) return null;
	const { visit, clicks, consent } = attribution;
	const mapping = findMapping(
		await getTrackingConfig(visit.campaign_id),
		'offline',
		query.name,
		query.action
	);
	const reasons: string[] = [];
	if (visit.visited_at > before) reasons.push('outcome_predates_visit');
	if (before.getTime() > Date.now() + 60000) reasons.push('outcome_in_future');
	if (!mapping) reasons.push('missing_offline_mapping');
	const click = clicks[0];
	if (!click) reasons.push('missing_click_id');
	else if (Date.now() - click.captured_at.getTime() > 90 * 86400000) reasons.push('click_expired');
	const blocked = consentBlock(consent);
	if (blocked) reasons.push(blocked);
	if (!env.CRM_WRITE_API_TOKEN) reasons.push('crm_write_not_configured');
	if (!googleConfigured()) reasons.push('google_not_configured');
	if (!env.CRON_SECRET) reasons.push('processor_not_configured');
	return { ...attribution, mapping, reasons };
}

export async function getVisitTracking(
	visitId: number,
	query: z.infer<typeof visitTrackingQuerySchema>
) {
	const result = await visitReadiness(visitId, query);
	if (!result) return null;
	const rows = await db
		.select({
			delivery: conversion_deliveries,
			name: tracking_events.event_name,
			action: tracking_events.action,
			occurredAt: tracking_events.occurred_at
		})
		.from(tracking_events)
		.innerJoin(conversion_deliveries, eq(conversion_deliveries.event_id, tracking_events.id))
		.where(eq(tracking_events.campaign_visit_id, visitId))
		.orderBy(desc(tracking_events.occurred_at))
		.limit(101);
	return {
		visitId,
		campaignId: result.visit.campaign_id,
		clicks: result.clicks.map((c) => ({ kind: c.kind, capturedAt: c.captured_at })),
		consent: {
			adUserDataConsent: result.consent?.ad_user_data ?? 'GRANTED',
			source: result.consent ? 'visitor_record' : 'owner_default',
			recordedAt: result.consent?.recorded_at ?? null,
			policyVersion: result.consent?.policy_version ?? null
		},
		readiness: {
			ready: result.reasons.length === 0,
			reasons: result.reasons,
			name: query.name,
			action: query.action ?? null,
			checkedAt: new Date().toISOString()
		},
		deliveries: rows.slice(0, 100).map(({ delivery: d, ...event }) => ({
			...event,
			id: d.id,
			eventId: d.event_id,
			status: d.status,
			attempts: d.attempts,
			googleRequestId: d.google_request_id,
			lastError: d.last_error,
			nextAttemptAt: d.next_attempt_at,
			updatedAt: d.updated_at
		})),
		deliveriesTruncated: rows.length > 100
	};
}
