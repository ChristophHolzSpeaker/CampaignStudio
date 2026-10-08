import type { TrackingConfig } from './contract';

const destinations = {
	booking_request_email_qualified: '7755647198',
	booking_calendar_confirmed: '7755799332',
	ai_assistant_email_response: '7755799335'
};

export function withNativeOutcomeDefaults(config: TrackingConfig): TrackingConfig {
	const mappings = [...config.mappings];
	for (const [event, conversionActionId] of Object.entries(destinations)) {
		if (
			!mappings.some(
				(mapping) => mapping.channel === 'offline' && mapping.event === event && !mapping.action
			)
		) {
			mappings.push({ event, channel: 'offline', customerId: '2354667197', conversionActionId });
		}
	}
	return { ...config, mappings };
}
