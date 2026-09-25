import { expect, it } from 'vitest';
import { findMapping } from './contract';
import { withManualOutcomeDefaults } from './manual-outcomes';
it('maps the company and lead manual aliases to the owner-selected existing action', () => {
	const config = withManualOutcomeDefaults({ gtmContainerId: null, mappings: [] });
	for (const event of ['company_identified', 'lead_marked_eligible'])
		expect(findMapping(config, 'offline', event)).toMatchObject({
			customerId: '2354667197',
			conversionActionId: '7755799338'
		});
	expect(findMapping(config, 'browser', 'company_identified')).toBeUndefined();
	expect(findMapping(config, 'offline', 'unmapped')).toBeUndefined();
});
it('preserves per-campaign overrides, browser mappings and container without duplicates', () => {
	const input = {
		gtmContainerId: 'GTM-EXAMPLE',
		mappings: [
			{
				channel: 'offline' as const,
				event: 'company_identified',
				customerId: '1234567890',
				conversionActionId: '999'
			},
			{
				channel: 'browser' as const,
				event: 'cta_click',
				conversionId: 'AW-123',
				conversionLabel: 'label'
			}
		]
	};
	const result = withManualOutcomeDefaults(input);
	expect(findMapping(result, 'offline', 'company_identified')?.conversionActionId).toBe('999');
	expect(result.gtmContainerId).toBe(input.gtmContainerId);
	expect(result.mappings).toContainEqual(input.mappings[1]);
	expect(withManualOutcomeDefaults(result)).toEqual(result);
	expect(input.mappings).toHaveLength(2);
});
