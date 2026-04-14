import { db } from '$lib/server/db';
import { lead_events } from '$lib/server/db/schema';
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
