import { journeyConsent } from './journey-consent';
import { createHash } from 'node:crypto';
import { db } from '$lib/server/db';
import {
	conversion_deliveries,
	tracking_events,
	visit_ad_consent,
	ad_clicks
} from '$lib/server/db/schema';
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import { findMapping, outcomeSchema } from '$lib/tracking/contract';
import type { z } from 'zod';
import { journeyClicks } from './attribution';
import { getTrackingConfig } from './config';
import {
	GoogleDeliveryError,
	conversionStatus,
	googleConfigured,
	ingestConversion
} from './google';
import { env } from '$env/dynamic/private';
import { OutcomeError } from './errors';
import { visitReadiness, consentBlock } from './visits';
export { OutcomeError } from './errors';
type Outcome = z.infer<typeof outcomeSchema>;
export function recordOutcome(journeyId: string, input: Outcome, source: 'crm' | 'worker' = 'crm') {
	return recordScopedOutcome({ journeyId }, input, source);
}
export function recordVisitOutcome(visitId: number, input: Outcome) {
	return recordScopedOutcome({ visitId }, input);
}
async function recordScopedOutcome(
	scope: { journeyId: string; visitId?: never } | { visitId: number; journeyId?: never },
	input: Outcome,
	source: 'crm' | 'worker' = 'crm'
) {
	const key =
		scope.visitId !== undefined
			? `visit:${scope.visitId}:${input.externalEventId}`
			: `${scope.journeyId}:${input.externalEventId}`;
	const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
	const [existing] = await db
		.select()
		.from(conversion_deliveries)
		.where(eq(conversion_deliveries.request_key, key))
		.limit(1);
	if (existing) {
		if (existing.payload_hash !== hash)
			throw new OutcomeError(409, 'externalEventId already used with different data');
		return existing;
	}
	const eventId = crypto.randomUUID();
	const { campaignId, pageId, click, consentSource, blocked, payload } = await prepareOutcome(
		scope,
		input,
		eventId
	);

	return db.transaction(async (tx) => {
		// Serialize only this business event so concurrent retries cannot create orphan events.
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key},0))`);
		const [duplicate] = await tx
			.select()
			.from(conversion_deliveries)
			.where(eq(conversion_deliveries.request_key, key))
			.limit(1);
		if (duplicate) {
			if (duplicate.payload_hash !== hash)
				throw new OutcomeError(409, 'externalEventId already used with different data');
			return duplicate;
		}
		await tx.insert(tracking_events).values({
			id: eventId,
			campaign_id: campaignId,
			lead_journey_id: scope.journeyId,
			campaign_visit_id: scope.visitId,
			campaign_page_id: pageId,
			event_name: input.name,
			source,
			action: input.action,
			payload: consentSource ? { ...input, consentSource } : input,
			occurred_at: new Date(input.occurredAt)
		});
		const [delivery] = await tx
			.insert(conversion_deliveries)
			.values({
				event_id: eventId,
				click_captured_at: click?.captured_at,
				request_key: key,
				payload_hash: hash,
				request_payload: payload,
				status: blocked ? 'blocked' : 'pending',
				last_error: blocked
			})
			.returning();
		return delivery;
	});
}
export function deliveryView(row: typeof conversion_deliveries.$inferSelect) {
	return {
		id: row.id,
		eventId: row.event_id,
		status: row.status,
		attempts: row.attempts,
		googleRequestId: row.google_request_id,
		lastError: row.last_error,
		nextAttemptAt: row.next_attempt_at,
		updatedAt: row.updated_at
	};
}
export async function processConversions(deliveryIds?: string[]) {
	if (deliveryIds?.length === 0) return { processed: 0 };
	if (!googleConfigured()) return { processed: 0, reason: 'google_not_configured' };
	const candidates = await db
		.select()
		.from(conversion_deliveries)
		.where(
			and(
				inArray(conversion_deliveries.status, ['pending', 'accepted', 'processing']),
				deliveryIds ? inArray(conversion_deliveries.id, deliveryIds) : undefined,
				lte(conversion_deliveries.next_attempt_at, new Date())
			)
		)
		.orderBy(asc(conversion_deliveries.next_attempt_at))
		.limit(10);
	let processed = 0;
	await Promise.all(
		candidates.map(async (candidate) => {
			const [row] = await db
				.update(conversion_deliveries)
				.set({
					status: 'processing',
					next_attempt_at: new Date(Date.now() + 5 * 60000),
					attempts: sql`${conversion_deliveries.attempts}+1`,
					updated_at: new Date()
				})
				.where(
					and(
						eq(conversion_deliveries.id, candidate.id),
						lte(conversion_deliveries.next_attempt_at, new Date()),
						inArray(conversion_deliveries.status, ['pending', 'accepted', 'processing'])
					)
				)
				.returning();
			if (!row) return;
			try {
				if (row.google_request_id) {
					const result = await conversionStatus(row.google_request_id);
					await db
						.update(conversion_deliveries)
						.set({
							status: result.status,
							last_error: result.error,
							next_attempt_at: new Date(Date.now() + 30 * 60000),
							updated_at: new Date()
						})
						.where(eq(conversion_deliveries.id, row.id));
				} else {
					if (row.click_captured_at && Date.now() - row.click_captured_at.getTime() > 90 * 86400000)
						throw new GoogleDeliveryError('click_expired', false);
					const [event] = await db
						.select()
						.from(tracking_events)
						.where(eq(tracking_events.id, row.event_id))
						.limit(1);
					if (
						event?.lead_journey_id &&
						(await journeyConsent(event.lead_journey_id, event.occurred_at)).denied
					) {
						await db
							.update(conversion_deliveries)
							.set({ status: 'blocked', last_error: 'consent_denied', updated_at: new Date() })
							.where(eq(conversion_deliveries.id, row.id));
						processed++;
						return;
					}
					if (event?.campaign_visit_id && !event.lead_journey_id) {
						const [consent] = await db
							.select()
							.from(visit_ad_consent)
							.where(eq(visit_ad_consent.campaign_visit_id, event.campaign_visit_id));
						const reason = consentBlock(consent);
						if (reason) {
							await db
								.update(conversion_deliveries)
								.set({ status: 'blocked', last_error: reason, updated_at: new Date() })
								.where(eq(conversion_deliveries.id, row.id));
							processed++;
							return;
						}
					}
					const requestId = await ingestConversion(row.request_payload);
					await db
						.update(conversion_deliveries)
						.set({
							status: 'accepted',
							google_request_id: requestId,
							last_error: null,
							next_attempt_at: new Date(Date.now() + 30 * 60000),
							updated_at: new Date()
						})
						.where(eq(conversion_deliveries.id, row.id));
				}
			} catch (error) {
				const retry = !(error instanceof GoogleDeliveryError) || error.retryable;
				await db
					.update(conversion_deliveries)
					.set({
						status:
							retry && row.attempts < 20
								? row.google_request_id
									? 'accepted'
									: 'pending'
								: 'failed',
						last_error:
							error instanceof GoogleDeliveryError ? error.code : 'delivery_request_failed',
						next_attempt_at: new Date(
							Date.now() + Math.min(86400000, 60000 * 2 ** Math.min(row.attempts, 10))
						),
						updated_at: new Date()
					})
					.where(eq(conversion_deliveries.id, row.id));
			}
			processed++;
		})
	);
	return { processed };
}

async function prepareOutcome(
	scope: { journeyId: string; visitId?: never } | { visitId: number; journeyId?: never },
	input: Outcome,
	eventId: string
) {
	let campaignId: number;
	let pageId: number | undefined;
	let mapping: ReturnType<typeof findMapping>;
	let click: typeof ad_clicks.$inferSelect | undefined;
	let blocked: string | null = null;
	let consentSource: 'visitor_record' | 'owner_default' | undefined;
	if (scope.visitId !== undefined) {
		const result = await visitReadiness(scope.visitId, {
			name: input.name,
			action: input.action,
			occurredAt: input.occurredAt
		});
		if (!result) throw new OutcomeError(404, 'Visit not found');
		const reasons = [...result.reasons];
		if (input.adUserDataConsent !== 'GRANTED' && !reasons.includes('consent_denied'))
			reasons.push('consent_denied');
		if (reasons.length)
			throw new OutcomeError(422, 'Visit is not ready for conversion delivery', reasons);
		consentSource = result.consent ? 'visitor_record' : 'owner_default';
		campaignId = result.visit.campaign_id;
		pageId = result.visit.campaign_page_id ?? undefined;
		mapping = result.mapping;
		click = result.clicks[0];
	} else {
		const attribution = await journeyClicks(scope.journeyId, new Date(input.occurredAt));
		if (!attribution) throw new OutcomeError(404, 'Journey not found');
		const id = attribution.journey.campaign_id ?? attribution.journey.first_campaign_id;
		if (!id) throw new OutcomeError(422, 'Journey has no campaign');
		campaignId = id;
		pageId = attribution.journey.campaign_page_id ?? undefined;
		const consent = await journeyConsent(scope.journeyId, new Date(input.occurredAt));
		consentSource = consent.source;
		mapping = findMapping(await getTrackingConfig(campaignId), 'offline', input.name, input.action);
		click = attribution.clicks[0];
		blocked =
			input.adUserDataConsent !== 'GRANTED' || consent.denied
				? 'consent_denied'
				: !click
					? 'missing_click_id'
					: Date.now() - click.captured_at.getTime() > 90 * 86400000
						? 'click_expired'
						: null;
	}
	if (!mapping)
		throw new OutcomeError(422, 'Configure an offline mapping for this event before retrying');
	const payload = {
		destinations: [
			{
				operatingAccount: { accountType: 'GOOGLE_ADS', accountId: mapping.customerId },
				...(env.GOOGLE_DATA_MANAGER_LOGIN_ACCOUNT_ID
					? {
							loginAccount: {
								accountType: 'GOOGLE_ADS',
								accountId: env.GOOGLE_DATA_MANAGER_LOGIN_ACCOUNT_ID
							}
						}
					: {}),
				productDestinationId: mapping.conversionActionId
			}
		],
		events: [
			{
				transactionId: eventId,
				eventSource: 'OTHER',
				eventTimestamp: input.occurredAt,
				...(click ? { adIdentifiers: { [click.kind]: click.click_id } } : {}),
				consent: {
					adUserData:
						input.adUserDataConsent === 'GRANTED' && blocked !== 'consent_denied'
							? 'CONSENT_GRANTED'
							: 'CONSENT_DENIED'
				},
				...((input.value ?? mapping.value) !== undefined
					? {
							conversionValue: input.value ?? mapping.value,
							currency: input.currency ?? mapping.currency
						}
					: {})
			}
		]
	};
	return { campaignId, pageId, click, consentSource, blocked, payload };
}

export async function refreshBlockedOutcome(id: string) {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ delivery: conversion_deliveries, event: tracking_events })
			.from(conversion_deliveries)
			.innerJoin(tracking_events, eq(tracking_events.id, conversion_deliveries.event_id))
			.where(eq(conversion_deliveries.id, id))
			.limit(1);
		if (!row || row.delivery.status !== 'blocked' || row.delivery.google_request_id)
			throw new OutcomeError(409, 'Only never-uploaded blocked deliveries can refresh eligibility');
		const stored = row.event.payload as Record<string, unknown>;
		const { consentSource: _consentSource, ...originalInput } = stored;
		const input = outcomeSchema.parse(originalInput);
		const scope = row.event.lead_journey_id
			? { journeyId: row.event.lead_journey_id }
			: row.event.campaign_visit_id
				? { visitId: row.event.campaign_visit_id }
				: null;
		if (!scope) throw new OutcomeError(409, 'Delivery has no attribution scope');
		const prepared = await prepareOutcome(scope, input, row.event.id);
		const original = row.delivery.request_payload as {
			destinations: unknown[];
			events: Array<Record<string, unknown>>;
		};
		const payload = {
			...original,
			events: [
				{
					...original.events[0],
					adIdentifiers: prepared.payload.events[0].adIdentifiers,
					consent: prepared.payload.events[0].consent
				}
			]
		};
		const [updated] = await tx
			.update(conversion_deliveries)
			.set({
				request_payload: payload,
				click_captured_at: prepared.click?.captured_at ?? null,
				status: prepared.blocked ? 'blocked' : 'pending',
				last_error: prepared.blocked,
				next_attempt_at: new Date(),
				updated_at: new Date()
			})
			.where(and(eq(conversion_deliveries.id, id), eq(conversion_deliveries.status, 'blocked')))
			.returning();
		if (!updated) throw new OutcomeError(409, 'Delivery changed; read again');
		return updated;
	});
}
