export const ctaTypes = ['email', 'booking', 'form'] as const;
export type CTAType = (typeof ctaTypes)[number];

export const eventTypes = [
	'email_cta_click',
	'booking_cta_click',
	'form_cta_click',
	'form_submitted',
	'email_received',
	'booking_link_generated'
] as const;
export type EventType = (typeof eventTypes)[number];

export const attributionStatuses = [
	'parsed',
	'missing_plus_address',
	'malformed_plus_address',
	'unresolved_campaign_page'
] as const;
export type AttributionStatus = (typeof attributionStatuses)[number];

export const CTA_EVENT_TYPE: Record<CTAType, EventType> = {
	email: 'email_cta_click',
	booking: 'booking_cta_click',
	form: 'form_cta_click'
};
