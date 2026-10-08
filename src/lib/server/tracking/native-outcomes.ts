import { and, asc, eq, gte, inArray, isNotNull, notExists, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { conversion_deliveries, lead_events, lead_journeys, bookings } from '$lib/server/db/schema';
import { OutcomeError } from './errors';
import { recordOutcome } from './outcomes';

const nativeEventNames = {
	lead_qualified: 'booking_request_email_qualified',
	autoresponse_sent: 'ai_assistant_email_response',
	auto_reply_sent: 'ai_assistant_email_response',
	booking_completed: 'booking_calendar_confirmed'
};

// Read durable business events, not HTTP callbacks. A cron retry recovers a missed run.
// Explicit activation prevents deployment from uploading the entire historical lead archive.
export async function reconcileNativeOutcomes() {
	const start = env.NATIVE_CONVERSIONS_START_AT;
	if (!start || !Number.isFinite(Date.parse(start)))
		return { recorded: 0, reason: 'native_conversions_not_configured' };
	const name = sql<string>`case
  when ${lead_events.event_type} = 'lead_qualified' then 'booking_request_email_qualified'
  when ${lead_events.event_type} in ('autoresponse_sent', 'auto_reply_sent') then 'ai_assistant_email_response'
  when ${lead_events.event_type} = 'booking_completed' then 'booking_calendar_confirmed'
 end`;
	const key = sql<string>`${lead_events.lead_journey_id}::text || ':cs:auto:' || ${name}`;
	const rows = await db
		.selectDistinctOn([lead_events.lead_journey_id, name], {
			journeyId: lead_events.lead_journey_id,
			eventType: lead_events.event_type,
			occurredAt: lead_events.occurred_at,
			name
		})
		.from(lead_events)
		.innerJoin(lead_journeys, eq(lead_journeys.id, lead_events.lead_journey_id))
		.where(
			and(
				isNotNull(lead_journeys.campaign_id),
				gte(lead_events.occurred_at, new Date(start)),
				inArray(lead_events.event_type, Object.keys(nativeEventNames)),
				// Only the mail classifier qualifies an incoming booking inquiry.
				sql`(${lead_events.event_type} <> 'lead_qualified' or ${lead_events.event_source} = 'worker.gmail_sync')`,
				// Only the actual Woody send path establishes this secondary outcome.
				sql`(${lead_events.event_type} not in ('autoresponse_sent', 'auto_reply_sent') or (${lead_events.event_type} = 'autoresponse_sent' and ${lead_events.event_source} = 'worker.autoresponse') or (${lead_events.event_type} = 'auto_reply_sent' and ${lead_events.event_source} = 'worker.gmail_send' and ${lead_events.event_payload}->>'auto_response_decision' = 'autoresponse_sent'))`,
				// Email booking links are separate from artifact widget/browser conversion events.
				sql`(${lead_events.event_type} <> 'booking_completed' or (
   ${lead_events.event_source} = 'sveltekit.book_lead_page' and exists (
    select 1 from ${bookings} where ${bookings.id}::text = ${lead_events.event_payload}->>'booking_id'
     and ${bookings.lead_journey_id} = ${lead_events.lead_journey_id}
     and ${bookings.status} = 'confirmed' and ${bookings.google_calendar_event_id} is not null
   )))`,
				notExists(
					db
						.select({ id: conversion_deliveries.id })
						.from(conversion_deliveries)
						.where(eq(conversion_deliveries.request_key, key))
				)
			)
		)
		.orderBy(lead_events.lead_journey_id, name, asc(lead_events.occurred_at), asc(lead_events.id))
		.limit(100);
	let recorded = 0;
	let failed = 0;
	for (const row of rows) {
		if (!row.journeyId) continue;
		try {
			await recordOutcome(
				row.journeyId,
				{
					externalEventId: 'cs:auto:' + row.name,
					name: row.name,
					occurredAt: row.occurredAt.toISOString(),
					adUserDataConsent: 'GRANTED'
				},
				'worker'
			);
			recorded++;
		} catch (error) {
			failed++;
			console.error('native_conversion_reconciliation_failed', {
				journeyId: row.journeyId,
				name: row.name,
				reason: error instanceof OutcomeError ? error.message : 'recording_failed'
			});
		}
	}
	return { recorded, failed };
}
