import { db } from '$lib/server/db';
import { lead_events } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import type { EventType } from '../../../../shared/event-types';

export async function logLeadEvent(input: {
	leadJourneyId: string;
	campaignId: number;
	campaignPageId: number;
	eventType: EventType;
	eventSource: string;
	eventPayload: Record<string, unknown>;
	sessionId?: string;
	anonymousId?: string;
}): Promise<void> {
	await db.insert(lead_events).values({
		lead_journey_id: input.leadJourneyId,
		campaign_id: input.campaignId,
		campaign_page_id: input.campaignPageId,
		event_type: input.eventType,
		event_source: input.eventSource,
		event_payload: input.eventPayload,
		session_id: input.sessionId ?? null,
		anonymous_id: input.anonymousId ?? null
	});
}

export async function getLatestFormSubmissionEventForJourney(leadJourneyId: string): Promise<{
	eventPayload: Record<string, unknown>;
	campaignId: number | null;
	campaignPageId: number | null;
	occurredAt: Date;
} | null> {
	const [event] = await db
		.select({
			eventPayload: lead_events.event_payload,
			campaignId: lead_events.campaign_id,
			campaignPageId: lead_events.campaign_page_id,
			occurredAt: lead_events.occurred_at
		})
		.from(lead_events)
		.where(
			and(
				eq(lead_events.lead_journey_id, leadJourneyId),
				eq(lead_events.event_type, 'form_submitted')
			)
		)
		.orderBy(desc(lead_events.occurred_at))
		.limit(1);

	if (!event) {
		return null;
	}

	return {
		eventPayload: (event.eventPayload as Record<string, unknown>) ?? {},
		campaignId: event.campaignId,
		campaignPageId: event.campaignPageId,
		occurredAt: event.occurredAt
	};
}
