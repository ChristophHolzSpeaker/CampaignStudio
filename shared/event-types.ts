export const ctaTypes = ['email', 'booking', 'form'] as const;
export type CTAType = (typeof ctaTypes)[number];

// Canonical analytics vocabulary for lead/journey attribution reporting.
// New writes should use these values.
export const analyticsEventTypes = [
	'page_view',
	'cta_impression',
	'cta_click',
	'form_started',
	'form_submitted',
	'lead_identified',
	'journey_created',
	'journey_matched_existing',
	'message_received',
	'message_classified',
	'auto_reply_sent',
	'manual_reply_sent',
	'booking_link_created',
	'booking_link_sent',
	'booking_link_clicked',
	'booking_started',
	'booking_completed',
	'booking_rescheduled',
	'booking_cancelled',
	'lead_qualified',
	'lead_disqualified'
] as const;
export type AnalyticsEventType = (typeof analyticsEventTypes)[number];

// Backwards-compatible event types emitted by earlier phases.
export const legacyEventTypes = [
	'email_cta_click',
	'booking_cta_click',
	'form_cta_click',
	'email_received',
	'booking_link_generated',
	'inbound_message_classified',
	'email_sent',
	'autoresponse_eligible',
	'autoresponse_skipped_internal_sender',
	'autoresponse_skipped_not_inquiry',
	'autoresponse_skipped_uncertain',
	'autoresponse_skipped_already_sent',
	'autoresponse_send_failed',
	'autoresponse_booking_link_fallback_used',
	'woody_reply_generation_failed',
	'woody_reply_generated',
	'autoresponse_send_attempted',
	'autoresponse_sent'
] as const;
export type LegacyEventType = (typeof legacyEventTypes)[number];

export const eventTypes = [...analyticsEventTypes, ...legacyEventTypes] as const;
export type EventType = AnalyticsEventType | LegacyEventType;

export const attributionStatuses = [
	'parsed',
	'missing_plus_address',
	'malformed_plus_address',
	'unresolved_campaign_page'
] as const;
export type AttributionStatus = (typeof attributionStatuses)[number];

export const CTA_EVENT_TYPE: Record<CTAType, AnalyticsEventType> = {
	email: 'cta_click',
	booking: 'cta_click',
	form: 'cta_click'
};

export const legacyToCanonicalEventType: Partial<Record<LegacyEventType, AnalyticsEventType>> = {
	email_cta_click: 'cta_click',
	booking_cta_click: 'cta_click',
	form_cta_click: 'cta_click',
	email_received: 'message_received',
	inbound_message_classified: 'message_classified',
	booking_link_generated: 'booking_link_created',
	autoresponse_sent: 'auto_reply_sent'
};

export function toCanonicalAnalyticsEventType(eventType: EventType): AnalyticsEventType | null {
	if ((analyticsEventTypes as readonly string[]).includes(eventType)) {
		return eventType as AnalyticsEventType;
	}

	return legacyToCanonicalEventType[eventType as LegacyEventType] ?? null;
}
