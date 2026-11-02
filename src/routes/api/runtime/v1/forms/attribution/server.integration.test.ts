import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
vi.mock('$env/dynamic/private', () => ({
	env: {
		DATABASE_URL:
			process.env.CS_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54322/postgres',
		ARTIFACT_PREVIEW_TOKEN_SECRET: 'local-integration-secret'
	}
}));
const mocks = vi.hoisted(() => ({ page: vi.fn(), config: vi.fn() }));
vi.mock('$lib/server/artifacts/repository', () => ({ getPublishedArtifactPageById: mocks.page }));
vi.mock('$lib/server/tracking/config', () => ({ getTrackingConfig: mocks.config }));
vi.mock('$lib/server/runtime/http', () => ({
	enforceSameOrigin: (request: Request, url: URL) =>
		request.headers.get('origin') === url.origin ? null : new Response(null, { status: 403 }),
	enforceRuntimeRateLimit: async () => null,
	readLimitedJson: (request: Request) => request.json()
}));
import { db } from '$lib/server/db';
import {
	campaigns,
	campaign_pages,
	campaign_visits,
	lead_events,
	lead_journeys,
	ad_clicks,
	visit_ad_clicks,
	visit_ad_consent
} from '$lib/server/db/schema';
import { createVisitReceipt } from '$lib/server/attribution/visit-receipt';
import { createFormAttributionReceipt } from '$lib/server/attribution/form-attribution-receipt';
import { captureAdClicks, journeyClicks } from '$lib/server/tracking/attribution';
import { consentSettingsSchema } from '$lib/tracking/contract';
import { POST } from './+server';

describe.runIf(Boolean(process.env.CS_TEST_DATABASE_URL))(
	'form attribution against local Postgres',
	() => {
		let campaignId: number, pageId: number, visitId: number, journeyId: string, eventId: string;
		const visitor = crypto.randomUUID();
		const evidenceRef = 'cs:' + crypto.randomUUID();
		beforeEach(async () => {
			if (!['localhost', '127.0.0.1'].includes(new URL(process.env.CS_TEST_DATABASE_URL!).hostname))
				throw Error('Local database required');
			const [c] = await db
				.insert(campaigns)
				.values({
					name: 'form attribution test',
					audience: 'test',
					format: 'test',
					topic: 'test',
					language: 'de',
					geography: 'test',
					status: 'published'
				})
				.returning();
			campaignId = c.id;
			const [p] = await db
				.insert(campaign_pages)
				.values({
					campaign_id: campaignId,
					slug: 'form-race-' + crypto.randomUUID(),
					renderer_type: 'artifact',
					is_published: true
				})
				.returning();
			pageId = p.id;
			const [v] = await db
				.insert(campaign_visits)
				.values({
					campaign_id: campaignId,
					campaign_page_id: pageId,
					slug: p.slug,
					ip_hash_or_session_identifier: visitor,
					visited_at: new Date(Date.now() - 10_000)
				})
				.returning();
			visitId = v.id;
			await db.insert(visit_ad_consent).values({
				campaign_visit_id: visitId,
				ad_user_data: 'GRANTED',
				evidence_ref: evidenceRef,
				policy_version: 'cs-consent-v1',
				expires_at: new Date(Date.now() + 86400_000)
			});
			const [j] = await db
				.insert(lead_journeys)
				.values({ campaign_id: campaignId, campaign_page_id: pageId, first_touch_type: 'form' })
				.returning();
			journeyId = j.id;
			const [e] = await db
				.insert(lead_events)
				.values({
					lead_journey_id: journeyId,
					campaign_id: campaignId,
					campaign_page_id: pageId,
					event_type: 'form_submitted',
					event_source: 'sveltekit.artifact_lead_intake'
				})
				.returning();
			eventId = e.id;
			mocks.page.mockResolvedValue({ campaignId, campaignPageId: pageId, runtimeVersion: 'v8' });
			mocks.config.mockResolvedValue({ consent: consentSettingsSchema.parse({}) });
		});
		afterEach(async () => {
			if (!campaignId) return;
			await db.delete(visit_ad_clicks).where(eq(visit_ad_clicks.campaign_visit_id, visitId));
			await db.delete(ad_clicks).where(eq(ad_clicks.visitor_id, visitor));
			await db.delete(lead_events).where(eq(lead_events.lead_journey_id, journeyId));
			await db.delete(lead_journeys).where(eq(lead_journeys.id, journeyId));
			await db.delete(campaign_visits).where(eq(campaign_visits.id, visitId));
			await db.delete(campaign_pages).where(eq(campaign_pages.id, pageId));
			await db.delete(campaigns).where(eq(campaigns.id, campaignId));
		});
		function call(marketing: boolean, actualVisitor = visitor, statistics = false) {
			const choice = JSON.stringify({
				statistics,
				marketing,
				personalization: false,
				policyVersion: 'cs-consent-v1',
				evidenceRef,
				expiresAt: Date.now() + 86400_000
			});
			return POST({
				request: new Request('https://app.example/api/runtime/v1/forms/attribution', {
					method: 'POST',
					headers: { origin: 'https://app.example', 'content-type': 'application/json' },
					body: JSON.stringify({
						campaignPageId: pageId,
						visitId,
						visitReceipt: createVisitReceipt(visitId, pageId),
						attributionReceipt: createFormAttributionReceipt({
							formEventId: eventId,
							campaignPageId: pageId,
							policyVersion: 'cs-consent-v1',
							evidenceRef
						})
					})
				}),
				url: new URL('https://app.example/api/runtime/v1/forms/attribution'),
				cookies: {
					get: (name: string) =>
						name === 'cs_vid' ? actualVisitor : name === 'cs_consent' ? choice : undefined
				}
			} as never);
		}
		it('links the exact event and its independently captured click after a slow visit', async () => {
			await captureAdClicks({
				visitorIdentifier: visitor,
				visitId,
				campaignId,
				campaignPageId: pageId,
				searchParams: new URLSearchParams('gclid=local-test-click')
			});
			expect((await call(true)).status).toBe(200);
			const [event] = await db.select().from(lead_events).where(eq(lead_events.id, eventId));
			expect(event.campaign_visit_id).toBe(visitId);
			expect((await journeyClicks(journeyId))?.clicks.map((c) => c.click_id)).toContain(
				'local-test-click'
			);
			expect((await call(true)).status).toBe(200);
		});
		it('never links without Marketing or statistics consent, or with another browser cookie', async () => {
			expect((await call(false)).status).toBe(403);
			expect((await call(true, crypto.randomUUID())).status).toBe(404);
			const [event] = await db.select().from(lead_events).where(eq(lead_events.id, eventId));
			expect(event.campaign_visit_id).toBeNull();
		});
		it('links a measurement-consented visit without granting marketing consent', async () => {
			await db
				.update(visit_ad_consent)
				.set({ ad_user_data: 'DENIED' })
				.where(eq(visit_ad_consent.campaign_visit_id, visitId));
			expect((await call(false, visitor, true)).status).toBe(200);
			const [event] = await db.select().from(lead_events).where(eq(lead_events.id, eventId));
			expect(event.campaign_visit_id).toBe(visitId);
			const [consent] = await db
				.select()
				.from(visit_ad_consent)
				.where(eq(visit_ad_consent.campaign_visit_id, visitId));
			expect(consent.ad_user_data).toBe('DENIED');
		});
	}
);
