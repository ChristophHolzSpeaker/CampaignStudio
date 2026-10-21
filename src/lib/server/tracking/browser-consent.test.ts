import { expect, it } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { browserStatisticsAllowed } from './browser-consent';
import { consentSettingsSchema } from '$lib/tracking/contract';
const cookie = (choice: unknown) => ({ get: () => JSON.stringify(choice) }) as unknown as Cookies;
const selected = {
	statistics: true,
	marketing: false,
	personalization: false,
	policyVersion: 'cs-consent-v1',
	evidenceRef: 'cs:' + crypto.randomUUID(),
	expiresAt: Date.now() + 86400000
};
it('authorizes statistics only for a valid, current opt-in cookie', () => {
	expect(browserStatisticsAllowed(cookie(selected))).toBe(true);
	for (const choice of [
		null,
		{},
		{ ...selected, statistics: false },
		{ ...selected, policyVersion: 'old' },
		{ ...selected, expiresAt: Date.now() - 1 },
		{ ...selected, expiresAt: Date.now() + 366 * 86400000 }
	])
		expect(browserStatisticsAllowed(cookie(choice))).toBe(false);
});
it('supports an explicit owner classification of necessary measurement', () => {
	expect(
		browserStatisticsAllowed(
			cookie(null),
			consentSettingsSchema.parse({ ownMeasurement: 'necessary' })
		)
	).toBe(true);
});
