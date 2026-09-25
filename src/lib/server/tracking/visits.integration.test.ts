import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
vi.mock('$env/dynamic/private', () => ({
	env: {
		DATABASE_URL: process.env.CS_TEST_DATABASE_URL,
		CRM_WRITE_API_TOKEN: 'test',
		CRON_SECRET: 'test'
	}
}));
vi.mock('./google', () => ({
	googleConfigured: () => true,
	ingestConversion: vi.fn(async () => 'request'),
	conversionStatus: vi.fn(async () => ({ status: 'delivered', error: null })),
	GoogleDeliveryError: class extends Error {}
}));
import { db } from '$lib/server/db';
import {
	campaigns,
	campaign_pages,
	campaign_visits,
	ad_clicks,
	campaign_tracking,
	tracking_events,
	conversion_deliveries
} from '$lib/server/db/schema';
import { logCampaignVisit } from '$lib/server/attribution/campaign-visits';
import { recordVisitOutcome, processConversions } from './outcomes';
import { recordVisitConsent, getVisitTracking } from './visits';
import { ingestConversion } from './google';

describe.skipIf(!process.env.CS_TEST_DATABASE_URL)('manual visit conversions', () => {
	let campaignId: number, pageId: number, visitId: number, otherVisitId: number;
	const visitor = crypto.randomUUID();
	const consent = {
		adUserDataConsent: 'GRANTED' as const,
		evidenceRef: 'cmp:test:choice',
		policyVersion: 'ads-v1'
	};
	const outcome = () => ({
		name: 'company_identified',
		externalEventId: 'manual:visit:test',
		occurredAt: new Date().toISOString(),
		adUserDataConsent: 'GRANTED' as const
	});
	beforeAll(async () => {
		if (!['localhost', '127.0.0.1'].includes(new URL(process.env.CS_TEST_DATABASE_URL!).hostname))
			throw Error('Local database required');
		const [c] = await db
			.insert(campaigns)
			.values({
				name: 'Visit attribution regression',
				audience: 'test',
				format: 'test',
				topic: 'test',
				language: 'en',
				geography: 'test'
			})
			.returning();
		campaignId = c.id;
		const [p] = await db
			.insert(campaign_pages)
			.values({ campaign_id: campaignId, slug: 'visit-test-' + visitor, renderer_type: 'artifact' })
			.returning();
		pageId = p.id;
		const input = {
			campaignId,
			campaignPageId: pageId,
			slug: p.slug,
			headers: new Headers(),
			visitorIdentifier: visitor
		};
		visitId = (
			await logCampaignVisit({ ...input, searchParams: new URLSearchParams('gclid=first-click') })
		).visitId!;
		await db
			.update(campaign_visits)
			.set({ visited_at: new Date(Date.now() - 3600000) })
			.where(eq(campaign_visits.id, visitId));
		otherVisitId = (
			await logCampaignVisit({
				...input,
				searchParams: new URLSearchParams('gclid=other-visit-click')
			})
		).visitId!;
		await db.insert(campaign_tracking).values({
			campaign_id: campaignId,
			config: {
				mappings: [
					{
						event: 'company_identified',
						channel: 'offline',
						customerId: '2354667197',
						conversionActionId: '123'
					}
				]
			}
		});
	});
	afterAll(async () => {
		if (!campaignId) return;
		const es = await db
			.select({ id: tracking_events.id })
			.from(tracking_events)
			.where(eq(tracking_events.campaign_id, campaignId));
		if (es.length)
			await db.delete(conversion_deliveries).where(
				inArray(
					conversion_deliveries.event_id,
					es.map((e) => e.id)
				)
			);
		await db.delete(tracking_events).where(eq(tracking_events.campaign_id, campaignId));
		await db.delete(campaign_visits).where(eq(campaign_visits.campaign_id, campaignId));
		await db.delete(ad_clicks).where(eq(ad_clicks.visitor_id, visitor));
		await db.delete(campaign_pages).where(eq(campaign_pages.id, pageId));
		await db.delete(campaigns).where(eq(campaigns.id, campaignId));
	});
	it('exposes the granted owner default without inventing a visitor record', async () => {
		const tracking = await getVisitTracking(visitId, { name: 'company_identified' });
		expect(tracking?.readiness.ready).toBe(true);
		expect(tracking?.consent).toMatchObject({
			adUserDataConsent: 'GRANTED',
			source: 'owner_default',
			recordedAt: null
		});
		expect(tracking?.clicks.map((c) => c.kind)).toEqual(['gclid']);
	});
	it('rejects denied submissions without consuming their event ID', async () => {
		await expect(
			recordVisitOutcome(visitId, { ...outcome(), adUserDataConsent: 'DENIED' })
		).rejects.toMatchObject({ status: 422 });
		const rows = await db
			.select()
			.from(tracking_events)
			.where(eq(tracking_events.campaign_visit_id, visitId));
		expect(rows).toHaveLength(0);
	});
	it('does not allow another visitor to record consent', async () => {
		await expect(
			recordVisitConsent(visitId, consent, {
				visitorIdentifier: 'not-owner',
				campaignPageId: pageId
			})
		).rejects.toMatchObject({ status: 404 });
	});
	it('attributes only to the selected visit after both IP fields are cleared; retries are idempotent', async () => {
		await recordVisitConsent(visitId, consent, {
			visitorIdentifier: visitor,
			campaignPageId: pageId
		});
		await db
			.update(campaign_visits)
			.set({ ip_address: null, ip_hash_or_session_identifier: null })
			.where(eq(campaign_visits.id, visitId));
		const tracking = await getVisitTracking(visitId, { name: 'company_identified' });
		expect(tracking?.readiness.ready).toBe(true);
		const input = outcome();
		const [a, b] = await Promise.all([
			recordVisitOutcome(visitId, input),
			recordVisitOutcome(visitId, input)
		]);
		expect(a.id).toBe(b.id);
		expect(a.request_payload).toMatchObject({
			events: [{ adIdentifiers: { gclid: 'first-click' } }]
		});
		const [event] = await db
			.select()
			.from(tracking_events)
			.where(eq(tracking_events.id, a.event_id));
		expect(event.lead_journey_id).toBeNull();
		expect(event.campaign_visit_id).toBe(visitId);
		await expect(
			recordVisitOutcome(visitId, { ...input, name: 'different' })
		).rejects.toMatchObject({ status: 409 });
	});
	it('does not borrow consent from another visit on the same cookie', async () => {
		expect(
			(await getVisitTracking(otherVisitId, { name: 'company_identified' }))?.consent
		).toMatchObject({ source: 'owner_default', recordedAt: null });
	});

	it('rejects missing mappings without saving a delivery', async () => {
		await expect(
			recordVisitOutcome(visitId, { ...outcome(), name: 'unmapped', externalEventId: 'mapping' })
		).rejects.toMatchObject({
			status: 422,
			reasons: expect.arrayContaining(['missing_offline_mapping'])
		});
	});
	it('never assigns legacy clicks or a different visit click to a direct return', async () => {
		const [direct] = await db
			.insert(campaign_visits)
			.values({
				campaign_id: campaignId,
				campaign_page_id: pageId,
				slug: 'direct',
				ip_hash_or_session_identifier: visitor
			})
			.returning();
		await db.insert(ad_clicks).values({
			visitor_id: visitor,
			campaign_id: campaignId,
			campaign_page_id: pageId,
			kind: 'gclid',
			click_id: 'legacy-unlinked'
		});
		const tracking = await getVisitTracking(direct.id, { name: 'company_identified' });
		expect(tracking?.clicks).toEqual([]);
		expect(tracking?.readiness.reasons).toContain('missing_click_id');
	});
	it('moves an owner-default outcome through acceptance and delivery diagnostics', async () => {
		const input = { ...outcome(), externalEventId: 'delivery-flow' };
		const delivery = await recordVisitOutcome(otherVisitId, input);
		const [event] = await db
			.select()
			.from(tracking_events)
			.where(eq(tracking_events.id, delivery.event_id));
		expect(event.payload).toMatchObject({ consentSource: 'owner_default' });
		await processConversions([delivery.id]);
		const [accepted] = await db
			.select()
			.from(conversion_deliveries)
			.where(eq(conversion_deliveries.id, delivery.id));
		expect(accepted.status).toBe('accepted');
		expect(accepted.google_request_id).toBe('request');
		await db
			.update(conversion_deliveries)
			.set({ next_attempt_at: new Date(0) })
			.where(eq(conversion_deliveries.id, delivery.id));
		await processConversions([delivery.id]);
		const [delivered] = await db
			.select()
			.from(conversion_deliveries)
			.where(eq(conversion_deliveries.id, delivery.id));
		expect(delivered.status).toBe('delivered');
	});
	it('blocks queued uploads when consent is withdrawn', async () => {
		await recordVisitConsent(otherVisitId, consent, {
			visitorIdentifier: visitor,
			campaignPageId: pageId
		});
		const delivery = await recordVisitOutcome(otherVisitId, {
			...outcome(),
			externalEventId: 'withdrawal'
		});
		await recordVisitConsent(
			otherVisitId,
			{ ...consent, adUserDataConsent: 'DENIED' },
			{ visitorIdentifier: visitor, campaignPageId: pageId }
		);
		vi.mocked(ingestConversion).mockClear();
		await processConversions([delivery.id]);
		expect(ingestConversion).not.toHaveBeenCalled();
		const [updated] = await db
			.select()
			.from(conversion_deliveries)
			.where(eq(conversion_deliveries.id, delivery.id));
		expect(updated.status).toBe('blocked');
		expect(updated.last_error).toBe('consent_denied');
	});
});
