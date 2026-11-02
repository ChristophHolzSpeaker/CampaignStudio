import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { lead_events, visit_ad_consent } from '$lib/server/db/schema';
import { verifyFormAttributionReceipt } from '$lib/server/attribution/form-attribution-receipt';
import { verifyVisitReceipt } from '$lib/server/attribution/visit-receipt';
import {
	readVisitorIdentifier,
	resolveCampaignVisitId
} from '$lib/server/attribution/campaign-visits';
import { persistJourneyAttributionSnapshot } from '$lib/server/attribution/journey-attribution';
import { getPublishedArtifactPageById } from '$lib/server/artifacts/repository';
import { getTrackingConfig } from '$lib/server/tracking/config';
import { browserStatisticsAllowed, readBrowserConsent } from '$lib/server/tracking/browser-consent';
import {
	enforceRuntimeRateLimit,
	enforceSameOrigin,
	readLimitedJson
} from '$lib/server/runtime/http';
import type { RequestHandler } from './$types';

const schema = z
	.object({
		campaignPageId: z.number().int().positive(),
		visitId: z.number().int().positive(),
		visitReceipt: z.string().max(1024),
		attributionReceipt: z.string().max(1024)
	})
	.strict();

export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const reply = (body: unknown, status = 200) =>
		json(body, { status, headers: { 'Cache-Control': 'no-store' } });
	const originError = enforceSameOrigin(request, url);
	if (originError) return originError;
	const visitorIdentifier = readVisitorIdentifier(cookies);
	if (!visitorIdentifier) return reply({ ok: false, error: 'Visitor context is missing' }, 400);
	const rateError = await enforceRuntimeRateLimit(visitorIdentifier);
	if (rateError) return rateError;
	let parsed;
	try {
		parsed = schema.safeParse(await readLimitedJson(request));
	} catch {
		return reply({ ok: false, error: 'Invalid request body' }, 400);
	}
	if (!parsed.success) return reply({ ok: false, error: 'Invalid attribution request' }, 400);
	const { campaignPageId, visitId, visitReceipt, attributionReceipt } = parsed.data;
	const receipt = verifyFormAttributionReceipt(attributionReceipt, campaignPageId);
	if (!receipt || verifyVisitReceipt(visitReceipt, campaignPageId) !== visitId)
		return reply({ ok: false, error: 'Invalid attribution receipt' }, 403);
	const page = await getPublishedArtifactPageById(campaignPageId);
	if (!page || page.runtimeVersion !== 'v8')
		return reply({ ok: false, error: 'Page not found' }, 404);
	const settings = (await getTrackingConfig(page.campaignId)).consent;
	const choice = readBrowserConsent(cookies, settings);
	if (
		receipt.policyVersion !== settings.policyVersion ||
		(receipt.evidenceRef !== null
			? choice?.evidenceRef !== receipt.evidenceRef
			: settings.ownMeasurement !== 'necessary')
	)
		return reply({ ok: false, error: 'Attribution consent changed' }, 403);
	if (!browserStatisticsAllowed(cookies, settings) && choice?.marketing !== true)
		return reply({ ok: false, error: 'Attribution consent required' }, 403);
	const ownedVisit = await resolveCampaignVisitId({
		campaignId: page.campaignId,
		campaignPageId,
		visitorIdentifier,
		requestedVisitId: visitId
	});
	if (!ownedVisit) return reply({ ok: false, error: 'Visit not found' }, 404);
	if (receipt.evidenceRef !== null) {
		const [decision] = await db
			.select({ adUserData: visit_ad_consent.ad_user_data })
			.from(visit_ad_consent)
			.where(
				and(
					eq(visit_ad_consent.campaign_visit_id, visitId),
					eq(visit_ad_consent.evidence_ref, receipt.evidenceRef),
					eq(visit_ad_consent.policy_version, receipt.policyVersion),
					gt(visit_ad_consent.expires_at, new Date())
				)
			)
			.limit(1);
		if (!decision || decision.adUserData !== (choice?.marketing ? 'GRANTED' : 'DENIED'))
			return reply({ ok: false, error: 'Consent evidence unavailable' }, 403);
	}
	const where = and(
		eq(lead_events.id, receipt.formEventId),
		eq(lead_events.campaign_id, page.campaignId),
		eq(lead_events.campaign_page_id, campaignPageId),
		eq(lead_events.event_type, 'form_submitted'),
		eq(lead_events.event_source, 'sveltekit.artifact_lead_intake')
	);
	const [event] = await db
		.select({ journeyId: lead_events.lead_journey_id, visitId: lead_events.campaign_visit_id })
		.from(lead_events)
		.where(where)
		.limit(1);
	if (!event?.journeyId) return reply({ ok: false, error: 'Submission not found' }, 404);
	if (event.visitId && event.visitId !== visitId)
		return reply({ ok: false, error: 'Submission already linked' }, 409);
	if (!event.visitId) {
		const [updated] = await db
			.update(lead_events)
			.set({ campaign_visit_id: visitId, anonymous_id: visitorIdentifier })
			.where(and(where, isNull(lead_events.campaign_visit_id)))
			.returning({ id: lead_events.id });
		if (!updated) return reply({ ok: false, error: 'Submission already linked' }, 409);
	}
	await persistJourneyAttributionSnapshot({
		journeyId: event.journeyId,
		campaignId: page.campaignId,
		campaignPageId,
		visitorIdentifier,
		observedAt: new Date()
	});
	return reply({ ok: true });
};
