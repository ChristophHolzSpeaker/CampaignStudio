import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
vi.mock('$env/dynamic/private', () => ({
	env: {
		DATABASE_URL:
			process.env.CS_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
	}
}));
vi.mock('./google', () => ({
	googleConfigured: () => true,
	ingestConversion: vi.fn(async () => 'local-google-request'),
	conversionStatus: vi.fn(async () => ({ status: 'delivered', error: null })),
	GoogleDeliveryError: class extends Error {
		retryable = true;
		code = 'test';
	}
}));
import { db } from '$lib/server/db';
import {
	campaigns,
	campaign_pages,
	campaign_visits,
	lead_journeys,
	ad_clicks,
	campaign_tracking,
	tracking_events,
	conversion_deliveries
} from '$lib/server/db/schema';
import { captureAdClicks, journeyClicks } from './attribution';
import { recordOutcome, processConversions } from './outcomes';
import { ingestConversion } from './google';
const enabled = Boolean(process.env.CS_TEST_DATABASE_URL);
describe.runIf(enabled)('local Postgres conversion integration', () => {
	let campaignId: number, pageId: number, visitId: number, journeyId: string;
	const visitor = crypto.randomUUID();
	const occurredAt = new Date().toISOString();
	beforeAll(async () => {
		const url = new URL(process.env.CS_TEST_DATABASE_URL!);
		if (!['localhost', '127.0.0.1'].includes(url.hostname))
			throw new Error('Integration tests require local Postgres');
		const [c] = await db
			.insert(campaigns)
			.values({
				name: 'Tracking integration',
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
			.values({
				campaign_id: campaignId,
				slug: 'tracking-test-' + visitor,
				renderer_type: 'artifact'
			})
			.returning();
		pageId = p.id;
		const [v] = await db
			.insert(campaign_visits)
			.values({
				campaign_id: campaignId,
				campaign_page_id: pageId,
				slug: p.slug,
				ip_hash_or_session_identifier: visitor
			})
			.returning();
		visitId = v.id;
		const [j] = await db
			.insert(lead_journeys)
			.values({
				campaign_id: campaignId,
				first_visit_id: visitId,
				last_visit_id: visitId,
				first_touch_type: 'test'
			})
			.returning();
		journeyId = j.id;
		await db.insert(campaign_tracking).values({
			campaign_id: campaignId,
			config: {
				mappings: [
					{
						event: 'sale_won',
						channel: 'offline',
						customerId: '1234567890',
						conversionActionId: '123'
					}
				]
			}
		});
		await captureAdClicks({
			visitorIdentifier: visitor,
			campaignId,
			campaignPageId: pageId,
			searchParams: new URLSearchParams('gclid=local-test-click')
		});
		await db
			.update(ad_clicks)
			.set({ captured_at: new Date(Date.now() - 60000) })
			.where(eq(ad_clicks.visitor_id, visitor));
	});
	afterAll(async () => {
		if (!campaignId) return;
		const events = await db
			.select({ id: tracking_events.id })
			.from(tracking_events)
			.where(eq(tracking_events.campaign_id, campaignId));
		if (events.length)
			await db.delete(conversion_deliveries).where(
				inArray(
					conversion_deliveries.event_id,
					events.map((e) => e.id)
				)
			);
		await db.delete(tracking_events).where(eq(tracking_events.campaign_id, campaignId));
		await db.delete(lead_journeys).where(eq(lead_journeys.id, journeyId));
		await db.delete(ad_clicks).where(eq(ad_clicks.visitor_id, visitor));
		await db.delete(campaign_visits).where(eq(campaign_visits.id, visitId));
		await db.delete(campaign_pages).where(eq(campaign_pages.id, pageId));
		await db.delete(campaigns).where(eq(campaigns.id, campaignId));
	});
	it('keeps original click timestamp across repeated click and direct return', async () => {
		await captureAdClicks({
			visitorIdentifier: visitor,
			campaignId,
			campaignPageId: pageId,
			searchParams: new URLSearchParams('gclid=local-test-click')
		});
		await captureAdClicks({
			visitorIdentifier: visitor,
			campaignId,
			campaignPageId: pageId,
			searchParams: new URLSearchParams()
		});
		const result = await journeyClicks(journeyId);
		expect(result?.clicks).toHaveLength(1);
		expect(result!.clicks[0].captured_at.getTime()).toBeLessThan(Date.now() - 30000);
	});
	it('serializes concurrent CRM retries and rejects changed payloads', async () => {
		const input = {
			externalEventId: 'order-1',
			name: 'sale_won',
			occurredAt,
			value: 7500,
			currency: 'EUR',
			adUserDataConsent: 'GRANTED' as const
		};
		const results = await Promise.all([
			recordOutcome(journeyId, input),
			recordOutcome(journeyId, input)
		]);
		expect(results[0].id).toBe(results[1].id);
		expect(results[0].status).toBe('pending');
		expect(results[0].request_payload).toMatchObject({
			events: [
				{
					adIdentifiers: { gclid: 'local-test-click' },
					consent: { adUserData: 'CONSENT_GRANTED' },
					conversionValue: 7500,
					currency: 'EUR'
				}
			]
		});
		await expect(recordOutcome(journeyId, { ...input, value: 8000 })).rejects.toMatchObject({
			status: 409
		});
	});
	it('distinguishes Google acceptance from diagnosed delivery', async () => {
		vi.mocked(ingestConversion).mockClear();
		const deliveryIds = (
			await db
				.select({ id: conversion_deliveries.id })
				.from(conversion_deliveries)
				.where(eq(conversion_deliveries.request_key, journeyId + ':order-1'))
		).map((r) => r.id);
		await Promise.all([processConversions(deliveryIds), processConversions(deliveryIds)]);
		expect(ingestConversion).toHaveBeenCalledTimes(1);
		let rows = await db
			.select()
			.from(conversion_deliveries)
			.where(eq(conversion_deliveries.request_key, journeyId + ':order-1'));
		expect(rows[0].status).toBe('accepted');
		expect(ingestConversion).toHaveBeenCalled();
		await db
			.update(conversion_deliveries)
			.set({ next_attempt_at: new Date(0) })
			.where(eq(conversion_deliveries.id, rows[0].id));
		await processConversions(
			(
				await db
					.select({ id: conversion_deliveries.id })
					.from(conversion_deliveries)
					.where(eq(conversion_deliveries.request_key, journeyId + ':order-1'))
			).map((r) => r.id)
		);
		rows = await db
			.select()
			.from(conversion_deliveries)
			.where(eq(conversion_deliveries.id, rows[0].id));
		expect(rows[0].status).toBe('delivered');
	});
	it('records denied consent without uploading and requires mappings', async () => {
		expect(
			(
				await recordOutcome(journeyId, {
					externalEventId: 'order-2',
					name: 'sale_won',
					occurredAt,
					adUserDataConsent: 'DENIED'
				})
			).status
		).toBe('blocked');
		await expect(
			recordOutcome(journeyId, {
				externalEventId: 'order-3',
				name: 'unknown',
				occurredAt,
				adUserDataConsent: 'GRANTED'
			})
		).rejects.toMatchObject({ status: 422 });
	});
	it('stores expired and missing-click outcomes as blocked', async () => {
		await db
			.update(ad_clicks)
			.set({ captured_at: new Date(Date.now() - 95 * 86400000) })
			.where(eq(ad_clicks.visitor_id, visitor));
		expect(
			(
				await recordOutcome(journeyId, {
					externalEventId: 'expired',
					name: 'sale_won',
					occurredAt,
					adUserDataConsent: 'GRANTED'
				})
			).last_error
		).toBe('click_expired');
		await db.delete(ad_clicks).where(eq(ad_clicks.visitor_id, visitor));
		expect(
			(
				await recordOutcome(journeyId, {
					externalEventId: 'missing',
					name: 'sale_won',
					occurredAt,
					adUserDataConsent: 'GRANTED'
				})
			).last_error
		).toBe('missing_click_id');
	});
});
