import type { TrackingConfig } from './contract';

// Explicit operator decisions only. Both names target the same Ads action;
// clients must submit one business outcome, never both aliases for a decision.
const manualEvents = ['lead_marked_eligible', 'company_identified'] as const;
export function withManualOutcomeDefaults(config: TrackingConfig): TrackingConfig {
	const mappings = [...config.mappings];
	for (const event of manualEvents) {
		if (!mappings.some((m) => m.channel === 'offline' && m.event === event && !m.action)) {
			mappings.push({
				channel: 'offline',
				event,
				customerId: '2354667197',
				conversionActionId: '7755799338'
			});
		}
	}
	return { ...config, mappings };
}
