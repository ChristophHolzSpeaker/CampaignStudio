import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

vi.mock('$env/dynamic/private', () => ({
	env: {
		DATABASE_URL:
			process.env.CS_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
		CRM_WRITE_API_TOKEN: 'test',
		CRON_SECRET: 'test',
		NATIVE_CONVERSIONS_START_AT: ''
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
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import {
	campaigns,
	campaign_pages,
	campaign_visits,
	campaign_tracking,
	lead_journeys,
	lead_events,
	lead_messages,
	bookings,
	ad_clicks,
	conversion_deliveries,
	tracking_events,
	visit_ad_consent
} from '$lib/server/db/schema';
import { issueEmailVisitReference } from '$lib/server/attribution/email-reference';
import { resolveInboundJourney } from '../../../../worker/src/lib/journeys/resolve-inbound-journey';
import { makeTestEnv } from '../../../../worker/src/test/helpers';
import { captureAdClicks, journeyClicks } from './attribution';
import { recordOutcome, processConversions, refreshBlockedOutcome } from './outcomes';
import { reconcileNativeOutcomes } from './native-outcomes';
import { ingestConversion } from './google';

const enabled = Boolean(
	process.env.CS_TEST_DATABASE_URL &&
	process.env.CS_TEST_SUPABASE_URL &&
	process.env.CS_TEST_SUPABASE_SERVICE_ROLE_KEY
);
describe.runIf(enabled)(
	'email inquiry to automatic conversion with local Postgres and real worker REST access',
	() => {
		let campaignId: number, pageId: number, visitId: number, journeyId: string;
		let visitor: string, reference: string;
		const workerEnv = () =>
			makeTestEnv({
				SUPABASE_URL: process.env.CS_TEST_SUPABASE_URL!,
				SUPABASE_SERVICE_ROLE_KEY: process.env.CS_TEST_SUPABASE_SERVICE_ROLE_KEY!
			});
		const inbound = (bodyText = reference, page = pageId, sender = `${visitor}@example.com`) =>
			resolveInboundJourney(workerEnv(), {
				providerThreadId: visitor,
				normalizedSenderEmail: sender,
				senderDisplayName: 'Test lead',
				toRecipients: [`speakerlp+${page}@christophholz.com`],
				bodyText,
				observedAt: new Date()
			});
		const event = (
			eventType: string,
			source: string,
			payload: Record<string, unknown> = {},
			at = new Date()
		) =>
			db.insert(lead_events).values({
				lead_journey_id: journeyId,
				campaign_id: campaignId,
				campaign_page_id: pageId,
				campaign_visit_id: visitId,
				event_type: eventType,
				event_source: source,
				event_payload: payload,
				occurred_at: at
			});
		const deliveries = () =>
			db
				.select()
				.from(conversion_deliveries)
				.where(
					eq(
						conversion_deliveries.request_key,
						`${journeyId}:cs:auto:booking_request_email_qualified`
					)
				);
		beforeEach(async () => {
			for (const url of [process.env.CS_TEST_DATABASE_URL!, process.env.CS_TEST_SUPABASE_URL!]) {
				if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
					throw new Error('Integration tests require local Supabase');
			}
			vi.mocked(ingestConversion).mockClear();
			journeyId = '';
			visitor = crypto.randomUUID();
			env.NATIVE_CONVERSIONS_START_AT = new Date(Date.now() - 1000).toISOString();
			const [campaign] = await db
				.insert(campaigns)
				.values({
					name: 'Email attribution integration',
					audience: 'test',
					format: 'test',
					topic: 'test',
					language: 'de',
					geography: 'test',
					status: 'published'
				})
				.returning();
			campaignId = campaign.id;
			const [page] = await db
				.insert(campaign_pages)
				.values({
					campaign_id: campaignId,
					slug: `email-test-${visitor}`,
					renderer_type: 'artifact',
					is_published: true
				})
				.returning();
			pageId = page.id;
			const [visit] = await db
				.insert(campaign_visits)
				.values({
					campaign_id: campaignId,
					campaign_page_id: pageId,
					slug: page.slug,
					ip_hash_or_session_identifier: visitor,
					utm_source: 'google',
					utm_medium: 'cpc'
				})
				.returning();
			visitId = visit.id;
			await captureAdClicks({
				visitorIdentifier: visitor,
				visitId,
				campaignId,
				campaignPageId: pageId,
				searchParams: new URLSearchParams(`gclid=test-${visitor}`)
			});
			reference = (await issueEmailVisitReference({
				campaignId,
				campaignPageId: pageId,
				visitorIdentifier: visitor,
				requestedVisitId: visitId
			}))!;
			journeyId = (await inbound()).lead_journey_id;
		});
		afterEach(async () => {
			if (!campaignId) return;
			const events = await db
				.select({ id: tracking_events.id })
				.from(tracking_events)
				.where(eq(tracking_events.campaign_id, campaignId));
			if (events.length)
				await db.delete(conversion_deliveries).where(
					inArray(
						conversion_deliveries.event_id,
						events.map((row) => row.id)
					)
				);
			await db.delete(tracking_events).where(eq(tracking_events.campaign_id, campaignId));
			await db.delete(lead_events).where(eq(lead_events.campaign_id, campaignId));
			if (journeyId) await db.delete(bookings).where(eq(bookings.lead_journey_id, journeyId));
			await db.delete(lead_journeys).where(eq(lead_journeys.campaign_id, campaignId));
			await db.delete(ad_clicks).where(eq(ad_clicks.visitor_id, visitor));
			await db.delete(campaign_visits).where(eq(campaign_visits.campaign_id, campaignId));
			await db.delete(campaign_pages).where(eq(campaign_pages.campaign_id, campaignId));
			await db.delete(campaign_tracking).where(eq(campaign_tracking.campaign_id, campaignId));
			await db.delete(campaigns).where(eq(campaigns.id, campaignId));
		});
		it('links the exact email visit, preserves its UTM, and delivers qualification and one Woody reply', async () => {
			const attribution = await journeyClicks(journeyId);
			expect(attribution?.journey).toMatchObject({
				first_visit_id: visitId,
				last_visit_id: visitId,
				first_utm_source: 'google',
				first_utm_medium: 'cpc'
			});
			expect(attribution?.clicks[0].click_id).toBe(`test-${visitor}`);
			await event('lead_qualified', 'worker.gmail_sync');
			await event('auto_reply_sent', 'worker.gmail_send', {
				auto_response_decision: 'autoresponse_sent'
			});
			await event('autoresponse_sent', 'worker.autoresponse');
			expect(await reconcileNativeOutcomes()).toMatchObject({ recorded: 2, failed: 0 });
			expect(await reconcileNativeOutcomes()).toMatchObject({ recorded: 0 });
			const events = await db
				.select()
				.from(tracking_events)
				.where(eq(tracking_events.lead_journey_id, journeyId));
			expect(events).toHaveLength(2);
			expect(events.map((row) => row.payload)).toEqual(
				expect.arrayContaining([expect.objectContaining({ consentSource: 'owner_default' })])
			);
			const [delivery] = await deliveries();
			expect(delivery.status).toBe('pending');
			expect(delivery.request_payload).toMatchObject({
				destinations: [
					{ operatingAccount: { accountId: '2354667197' }, productDestinationId: '7755647198' }
				],
				events: [{ adIdentifiers: { gclid: `test-${visitor}` } }]
			});
			await processConversions([delivery.id]);
			expect(ingestConversion).toHaveBeenCalledOnce();
			expect((await deliveries())[0].status).toBe('accepted');
			await db
				.update(conversion_deliveries)
				.set({ next_attempt_at: new Date(0) })
				.where(eq(conversion_deliveries.id, delivery.id));
			await processConversions([delivery.id]);
			expect((await deliveries())[0].status).toBe('delivered');
		});
		it('only issues references to the visit owner and reuses the same opaque reference', async () => {
			expect(
				await issueEmailVisitReference({
					campaignId,
					campaignPageId: pageId,
					requestedVisitId: visitId,
					visitorIdentifier: 'other-browser'
				})
			).toBeNull();
			expect(
				await issueEmailVisitReference({
					campaignId,
					campaignPageId: pageId,
					requestedVisitId: visitId,
					visitorIdentifier: visitor
				})
			).toBe(reference);
		});
		it('keeps copied addresses, wrong-page references and conflicting references campaign-only', async () => {
			const [otherPage] = await db
				.insert(campaign_pages)
				.values({
					campaign_id: campaignId,
					slug: `other-${visitor}`,
					renderer_type: 'artifact',
					version_number: 2
				})
				.returning();
			for (const [body, page] of [
				['No reference', pageId],
				[reference, otherPage.id],
				[reference + '\nReferenz: CS-ffffffffffff4fff8fffffffffffffff', pageId]
			] as const) {
				const resolved = await inbound(body, page, `${crypto.randomUUID()}@example.com`);
				expect(resolved.campaign_visit_id).toBeNull();
				const attribution = await journeyClicks(resolved.lead_journey_id);
				expect(attribution?.journey.first_visit_id).toBeNull();
				expect(attribution?.clicks).toHaveLength(0);
			}
		});
		it('preserves the journey when a later email in its Gmail thread has no reference', async () => {
			await db.insert(lead_messages).values({
				lead_journey_id: journeyId,
				direction: 'inbound',
				provider: 'gmail',
				provider_message_id: visitor,
				provider_thread_id: visitor,
				from_email: `${visitor}@example.com`,
				to_email: `speakerlp+${pageId}@christophholz.com`,
				subject: 'Test inquiry',
				body_text: 'Test'
			});
			const result = await inbound('Follow-up without reference');
			expect(result).toMatchObject({
				lead_journey_id: journeyId,
				matched_by: 'thread',
				campaign_visit_id: null
			});
			expect((await journeyClicks(journeyId))?.clicks[0].click_id).toBe(`test-${visitor}`);
		});
		it('requires activation and excludes historical events, unrelated sources and drafts', async () => {
			await event('lead_qualified', 'worker.gmail_sync', {}, new Date(Date.now() - 60000));
			await event('lead_qualified', 'sveltekit.form');
			await event('woody_reply_generated', 'worker.autoresponse');
			await event('auto_reply_sent', 'worker.gmail_send', { auto_response_decision: null });
			env.NATIVE_CONVERSIONS_START_AT = '';
			expect(await reconcileNativeOutcomes()).toMatchObject({
				recorded: 0,
				reason: 'native_conversions_not_configured'
			});
			env.NATIVE_CONVERSIONS_START_AT = new Date(Date.now() - 1000).toISOString();
			expect(await reconcileNativeOutcomes()).toMatchObject({ recorded: 0 });
		});
		it('requires a confirmed calendar booking and excludes widget bookings', async () => {
			const [booking] = await db
				.insert(bookings)
				.values({
					booking_type: 'lead',
					lead_journey_id: journeyId,
					email: `${visitor}@example.com`,
					scope: 'test',
					starts_at: new Date(),
					ends_at: new Date(Date.now() + 1800000),
					status: 'pending_calendar_sync'
				})
				.returning();
			await event('booking_completed', 'sveltekit.book_lead_page', { booking_id: booking.id });
			expect(await reconcileNativeOutcomes()).toMatchObject({ recorded: 0 });
			await db
				.update(bookings)
				.set({ status: 'confirmed', google_calendar_event_id: 'test-event' })
				.where(eq(bookings.id, booking.id));
			await db
				.update(lead_events)
				.set({ event_source: 'sveltekit.inline_lead_booking_sequence' })
				.where(eq(lead_events.lead_journey_id, journeyId));
			expect(await reconcileNativeOutcomes()).toMatchObject({ recorded: 0 });
			await db
				.update(lead_events)
				.set({ event_source: 'sveltekit.book_lead_page' })
				.where(eq(lead_events.lead_journey_id, journeyId));
			expect(await reconcileNativeOutcomes()).toMatchObject({ recorded: 1 });
		});
		it('blocks denial, refreshes without changing the destination and rechecks denial before upload', async () => {
			await event('lead_qualified', 'worker.gmail_sync');
			await reconcileNativeOutcomes();
			const [original] = await deliveries();
			await db.insert(visit_ad_consent).values({
				campaign_visit_id: visitId,
				ad_user_data: 'DENIED',
				evidence_ref: 'test-choice',
				policy_version: 'test'
			});
			await processConversions([original.id]);
			expect(ingestConversion).not.toHaveBeenCalled();
			expect((await deliveries())[0]).toMatchObject({
				status: 'blocked',
				last_error: 'consent_denied'
			});
			expect((await refreshBlockedOutcome(original.id)).status).toBe('blocked');
			await db
				.update(visit_ad_consent)
				.set({ ad_user_data: 'GRANTED' })
				.where(eq(visit_ad_consent.campaign_visit_id, visitId));
			await db.insert(campaign_tracking).values({
				campaign_id: campaignId,
				config: {
					mappings: [
						{
							channel: 'offline',
							event: 'booking_request_email_qualified',
							customerId: '1234567890',
							conversionActionId: '999'
						}
					]
				}
			});
			const refreshed = await refreshBlockedOutcome(original.id);
			expect(refreshed).toMatchObject({
				id: original.id,
				event_id: original.event_id,
				payload_hash: original.payload_hash,
				status: 'pending'
			});
			expect(refreshed.request_payload).toMatchObject({
				destinations: [{ productDestinationId: '7755647198' }]
			});
			expect(
				(refreshed.request_payload as { events: Array<{ eventTimestamp: string }> }).events[0]
					.eventTimestamp
			).toBe(
				(original.request_payload as { events: Array<{ eventTimestamp: string }> }).events[0]
					.eventTimestamp
			);
			await processConversions([original.id]);
			await expect(refreshBlockedOutcome(original.id)).rejects.toMatchObject({ status: 409 });
		});
		it('records missing and expired clicks as blocked', async () => {
			const noVisit = await inbound('Copied address', pageId, `${crypto.randomUUID()}@example.com`);
			const blocked = await recordOutcome(noVisit.lead_journey_id, {
				externalEventId: 'missing',
				name: 'booking_request_email_qualified',
				occurredAt: new Date().toISOString(),
				adUserDataConsent: 'GRANTED'
			});
			expect(blocked).toMatchObject({ status: 'blocked', last_error: 'missing_click_id' });
			expect((await refreshBlockedOutcome(blocked.id)).status).toBe('blocked');
			await db
				.update(ad_clicks)
				.set({ captured_at: new Date(Date.now() - 95 * 86400000) })
				.where(eq(ad_clicks.visitor_id, visitor));
			await event('lead_qualified', 'worker.gmail_sync');
			await reconcileNativeOutcomes();
			expect((await deliveries())[0]).toMatchObject({
				status: 'blocked',
				last_error: 'click_expired'
			});
		});
	}
);
