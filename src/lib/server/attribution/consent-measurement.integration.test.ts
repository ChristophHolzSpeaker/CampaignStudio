import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: process.env.CS_TEST_DATABASE_URL }
}));
import { db } from '$lib/server/db';
import {
	campaigns,
	campaign_pages,
	campaign_visits,
	campaign_visit_metrics,
	vw_visit_enriched,
	ad_clicks
} from '$lib/server/db/schema';
import { logCampaignVisit } from './campaign-visits';

describe.skipIf(!process.env.CS_TEST_DATABASE_URL)('consent ownership and reporting', () => {
	let campaignId: number, pageId: number;
	const visitor = crypto.randomUUID();
	const visitors = [visitor];
	beforeAll(async () => {
		if (!['localhost', '127.0.0.1'].includes(new URL(process.env.CS_TEST_DATABASE_URL!).hostname))
			throw Error('Local database required');
		const [campaign] = await db
			.insert(campaigns)
			.values({
				name: 'Consent measurement regression',
				audience: 'test',
				format: 'test',
				topic: 'test',
				language: 'de',
				geography: 'test'
			})
			.returning();
		campaignId = campaign.id;
		const [page] = await db
			.insert(campaign_pages)
			.values({
				campaign_id: campaignId,
				slug: 'consent-measurement-' + visitor,
				renderer_type: 'artifact'
			})
			.returning();
		pageId = page.id;
	});
	afterAll(async () => {
		if (!campaignId) return;
		await db.delete(ad_clicks).where(inArray(ad_clicks.visitor_id, visitors));
		await db.delete(campaign_visits).where(eq(campaign_visits.campaign_id, campaignId));
		await db.delete(campaign_pages).where(eq(campaign_pages.id, pageId));
		await db.delete(campaigns).where(eq(campaigns.id, campaignId));
	});
	it('counts a cookieless IP visit and claims it after consent without duplication', async () => {
		const owner = crypto.randomUUID();
		visitors.push(owner);
		const input = {
			campaignId,
			campaignPageId: pageId,
			slug: 'consent-measurement-' + visitor,
			searchParams: new URLSearchParams('utm_source=baseline&gclid=not-permitted'),
			headers: new Headers({ 'x-forwarded-for': '203.0.113.12' }),
			captureAds: false
		};
		const baseline = await logCampaignVisit({ ...input, visitorIdentifier: null });
		const read = () =>
			db.select().from(campaign_visits).where(eq(campaign_visits.id, baseline.visitId!));
		expect((await read())[0]).toMatchObject({
			ip_address: '203.0.113.12',
			utm_source: 'baseline',
			ip_hash_or_session_identifier: null,
			is_consent_only: false
		});
		expect(
			await db
				.select()
				.from(vw_visit_enriched)
				.where(eq(vw_visit_enriched.visit_id, baseline.visitId!))
		).toHaveLength(1);
		const claimed = await logCampaignVisit({
			...input,
			visitorIdentifier: owner,
			receiptVisitId: baseline.visitId!
		});
		expect(claimed).toEqual({ logged: false, visitId: baseline.visitId });
		expect(await read()).toHaveLength(1);
		expect((await read())[0].ip_hash_or_session_identifier).toBe(owner);
		await expect(
			logCampaignVisit({
				...input,
				visitorIdentifier: 'another-browser',
				receiptVisitId: baseline.visitId!
			})
		).rejects.toThrow('no longer claimable');
		expect(await db.select().from(ad_clicks).where(eq(ad_clicks.visitor_id, owner))).toHaveLength(
			0
		);
		// Isolate the pre-existing reporting assertions below.
		await db.delete(campaign_visits).where(eq(campaign_visits.id, baseline.visitId!));
	});
	it('excludes rejected ownership records, upgrades once on opt-in, and preserves historical measurements on withdrawal', async () => {
		const input = {
			campaignId,
			campaignPageId: pageId,
			slug: 'consent-measurement-' + visitor,
			visitorIdentifier: visitor,
			searchParams: new URLSearchParams('utm_source=consent-test&gclid=consent-click'),
			headers: new Headers({
				referer: 'https://example.com/source',
				'user-agent': 'consent-test',
				'x-forwarded-for': '203.0.113.12',
				'x-vercel-ip-country': 'DE',
				'x-vercel-ip-city': 'Berlin'
			})
		};
		const read = async () => ({
			visits: await db
				.select()
				.from(campaign_visits)
				.where(eq(campaign_visits.campaign_id, campaignId)),
			metrics: await db
				.select()
				.from(campaign_visit_metrics)
				.where(eq(campaign_visit_metrics.campaign_id, campaignId)),
			reported: await db
				.select()
				.from(vw_visit_enriched)
				.where(eq(vw_visit_enriched.campaign_id, campaignId)),
			clicks: await db.select().from(ad_clicks).where(inArray(ad_clicks.visitor_id, visitors))
		});
		const ownership = await logCampaignVisit({ ...input, consentOnly: true });
		const rejected = await read();
		expect(rejected.visits).toHaveLength(1);
		expect(rejected.visits[0]).toMatchObject({
			id: ownership.visitId,
			is_consent_only: true,
			utm_source: null,
			referrer: null,
			user_agent: null,
			ip_address: null,
			country: null,
			city: null
		});
		expect(rejected.metrics[0]).toMatchObject({
			visit_count: 0,
			unique_visitor_count: 0,
			last_visited_at: null
		});
		expect(rejected.reported).toHaveLength(0);
		expect(rejected.clicks).toHaveLength(0);
		const measured = await logCampaignVisit({ ...input, consentOnly: false, captureAds: false });
		expect(measured.visitId).toBe(ownership.visitId);
		const accepted = await read();
		expect(accepted.visits).toHaveLength(1);
		expect(accepted.visits[0]).toMatchObject({
			is_consent_only: false,
			utm_source: 'consent-test',
			ip_address: '203.0.113.12',
			country: 'DE'
		});
		expect(accepted.metrics[0]).toMatchObject({ visit_count: 1, unique_visitor_count: 1 });
		expect(accepted.reported).toHaveLength(1);
		expect(accepted.clicks).toHaveLength(0);
		await logCampaignVisit({ ...input, consentOnly: false, captureAds: true });
		const advertising = await read();
		expect(advertising.clicks).toHaveLength(1);
		await logCampaignVisit({ ...input, consentOnly: true });
		expect(await read()).toEqual(advertising);
	});
	it('can capture explicitly permitted Marketing attribution without a statistical visit', async () => {
		const marketingVisitor = crypto.randomUUID();
		visitors.push(marketingVisitor);
		const metricsBefore = await db
			.select()
			.from(campaign_visit_metrics)
			.where(eq(campaign_visit_metrics.campaign_id, campaignId));
		const result = await logCampaignVisit({
			campaignId,
			campaignPageId: pageId,
			slug: 'consent-measurement-' + visitor,
			visitorIdentifier: marketingVisitor,
			searchParams: new URLSearchParams('gclid=marketing-only'),
			headers: new Headers({ 'x-forwarded-for': '203.0.113.12' }),
			consentOnly: true,
			captureAds: true
		});
		const [visit] = await db
			.select()
			.from(campaign_visits)
			.where(eq(campaign_visits.id, result.visitId!));
		expect(visit).toMatchObject({ is_consent_only: true, ip_address: null });
		expect(
			await db.select().from(ad_clicks).where(eq(ad_clicks.visitor_id, marketingVisitor))
		).toHaveLength(1);
		expect(
			await db
				.select()
				.from(vw_visit_enriched)
				.where(eq(vw_visit_enriched.visit_id, result.visitId!))
		).toHaveLength(0);
		expect(
			await db
				.select()
				.from(campaign_visit_metrics)
				.where(eq(campaign_visit_metrics.campaign_id, campaignId))
		).toEqual(metricsBefore);
	});
});
