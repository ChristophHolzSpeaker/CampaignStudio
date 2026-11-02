import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
vi.mock('$env/dynamic/private', () => ({
	env: {
		DATABASE_URL:
			process.env.CS_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54322/postgres'
	}
}));
import { db } from '$lib/server/db';
import {
	campaigns,
	campaign_pages,
	lead_journeys,
	lead_events,
	form_consent_evidence
} from '$lib/server/db/schema';
import {
	latestFormConsentEvidence,
	purgeExpiredFormConsentEvidence,
	recordFormConsentEvidence
} from './form-consent-evidence';

describe.runIf(Boolean(process.env.CS_TEST_DATABASE_URL))(
	'form consent evidence in local Postgres',
	() => {
		let campaignId: number, pageId: number, journeyId: string, firstEventId: string;
		beforeEach(async () => {
			if (!['localhost', '127.0.0.1'].includes(new URL(process.env.CS_TEST_DATABASE_URL!).hostname))
				throw Error('Local database required');
			const [c] = await db
				.insert(campaigns)
				.values({
					name: 'consent test',
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
					slug: 'consent-evidence-' + crypto.randomUUID(),
					renderer_type: 'artifact',
					is_published: true
				})
				.returning();
			pageId = p.id;
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
					event_source: 'sveltekit.artifact_lead_intake',
					occurred_at: new Date(Date.now() - 10_000)
				})
				.returning();
			firstEventId = e.id;
		});
		afterEach(async () => {
			if (!campaignId) return;
			await db.delete(lead_events).where(eq(lead_events.lead_journey_id, journeyId));
			await db.delete(lead_journeys).where(eq(lead_journeys.id, journeyId));
			await db.delete(campaign_pages).where(eq(campaign_pages.id, pageId));
			await db.delete(campaigns).where(eq(campaigns.id, campaignId));
		});
		it('reports only an explicit, unexpired choice for the latest submission', async () => {
			expect(await latestFormConsentEvidence(journeyId)).toBeNull();
			await recordFormConsentEvidence(firstEventId, {
				marketing: true,
				policyVersion: 'v1',
				evidenceRef: 'cs:' + crypto.randomUUID(),
				expiresAt: Date.now() + 60_000
			});
			expect(await latestFormConsentEvidence(journeyId)).toMatchObject({
				marketingAllowed: true,
				policyVersion: 'v1',
				source: 'browser_reported'
			});
			await db.insert(lead_events).values({
				lead_journey_id: journeyId,
				campaign_id: campaignId,
				event_type: 'form_submitted',
				event_source: 'sveltekit.book_lead_page'
			});
			expect(await latestFormConsentEvidence(journeyId)).toMatchObject({
				marketingAllowed: true,
				policyVersion: 'v1'
			});
			const [later] = await db
				.insert(lead_events)
				.values({
					lead_journey_id: journeyId,
					campaign_id: campaignId,
					campaign_page_id: pageId,
					event_type: 'form_submitted',
					event_source: 'sveltekit.artifact_lead_intake'
				})
				.returning();
			expect(await latestFormConsentEvidence(journeyId)).toBeNull();
			await recordFormConsentEvidence(later.id, {
				marketing: false,
				policyVersion: 'v2',
				evidenceRef: 'cs:' + crypto.randomUUID(),
				expiresAt: Date.now() + 60_000
			});
			expect(await latestFormConsentEvidence(journeyId)).toMatchObject({
				marketingAllowed: false,
				policyVersion: 'v2',
				source: 'browser_reported'
			});
		});
		it('does not disclose expired decisions and removes them during cleanup', async () => {
			await db.insert(form_consent_evidence).values({
				form_event_id: firstEventId,
				marketing_allowed: false,
				policy_version: 'v1',
				evidence_ref: 'cs:' + crypto.randomUUID(),
				expires_at: new Date(Date.now() - 1000)
			});
			expect(await latestFormConsentEvidence(journeyId)).toBeNull();
			await purgeExpiredFormConsentEvidence();
			expect(
				await db
					.select()
					.from(form_consent_evidence)
					.where(eq(form_consent_evidence.form_event_id, firstEventId))
			).toHaveLength(0);
		});
	}
);
