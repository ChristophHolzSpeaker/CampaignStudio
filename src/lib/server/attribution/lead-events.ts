import { db } from '$lib/server/db';
import { lead_events } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import type { EventType } from '../../../../shared/event-types';

export type LeadEventPayload = Record<string, unknown>;

type LeadEventInput = {
	leadJourneyId?: string | null;
	campaignId?: number | null;
	campaignPageId?: number | null;
	eventType: EventType;
	eventSource: string;
	eventPayload?: LeadEventPayload;
	sessionId?: string | null;
	anonymousId?: string | null;
	occurredAt?: Date;
	cta?: {
		key?: string | null;
		label?: string | null;
		section?: string | null;
		variant?: string | null;
	};
};

export async function logLeadEvent(input: LeadEventInput): Promise<void> {
	await db.insert(lead_events).values({
		lead_journey_id: input.leadJourneyId ?? null,
		campaign_id: input.campaignId ?? null,
		campaign_page_id: input.campaignPageId ?? null,
		event_type: input.eventType,
		event_source: input.eventSource,
		event_payload: input.eventPayload ?? {},
		cta_key: input.cta?.key ?? null,
		cta_label: input.cta?.label ?? null,
		cta_section: input.cta?.section ?? null,
		cta_variant: input.cta?.variant ?? null,
		session_id: input.sessionId ?? null,
		anonymous_id: input.anonymousId ?? null,
		occurred_at: input.occurredAt ?? new Date()
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
