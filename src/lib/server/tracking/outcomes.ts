import { createHash } from 'node:crypto';
import { db } from '$lib/server/db';
import { conversion_deliveries, tracking_events } from '$lib/server/db/schema';
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
export class OutcomeError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}
export async function recordOutcome(journeyId: string, input: z.infer<typeof outcomeSchema>) {
	const key = `${journeyId}:${input.externalEventId}`;
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
	const attribution = await journeyClicks(journeyId, new Date(input.occurredAt));
	if (!attribution) throw new OutcomeError(404, 'Journey not found');
	const campaignId = attribution.journey.campaign_id ?? attribution.journey.first_campaign_id;
	if (!campaignId) throw new OutcomeError(422, 'Journey has no campaign');
	const mapping = findMapping(
		await getTrackingConfig(campaignId),
		'offline',
		input.name,
		input.action
	);
	if (!mapping)
		throw new OutcomeError(422, 'Configure an offline mapping for this event before retrying');
	const click = attribution.clicks[0];
	const expired = click && Date.now() - click.captured_at.getTime() > 90 * 86400000;
	const blocked =
		input.adUserDataConsent === 'DENIED'
			? 'consent_denied'
			: !click
				? 'missing_click_id'
				: expired
					? 'click_expired'
					: null;
	const eventId = crypto.randomUUID();
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
				eventTimestamp: input.occurredAt,
				...(click ? { adIdentifiers: { [click.kind]: click.click_id } } : {}),
				consent: {
					adUserData: input.adUserDataConsent === 'GRANTED' ? 'CONSENT_GRANTED' : 'CONSENT_DENIED'
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
			lead_journey_id: journeyId,
			event_name: input.name,
			source: 'crm',
			action: input.action,
			payload: input,
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
