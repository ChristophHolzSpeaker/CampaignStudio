import type { CTAType, EventType } from './event-types';

export const leadJourneyTypes = ['form', 'email', 'booking', 'unknown'] as const;
export type LeadJourneyType = (typeof leadJourneyTypes)[number];

export type AttributionIdentity = {
	session_id?: string;
	anonymous_id?: string;
};

export type CTAEventInput = AttributionIdentity & {
	type: CTAType;
	campaign_id: number;
	campaign_page_id: number;
	lead_journey_id?: string;
};

export type LeadEventInput = AttributionIdentity & {
	lead_journey_id?: string;
	campaign_id?: number;
	campaign_page_id?: number;
	event_type: EventType;
	event_source: string;
	event_payload: Record<string, unknown>;
};
