import type { Cookies } from '@sveltejs/kit';
import { z } from 'zod';
import { consentSettingsSchema, type ConsentSettings } from '$lib/tracking/contract';
const browserChoiceSchema = z
	.object({
		statistics: z.boolean(),
		marketing: z.boolean(),
		personalization: z.boolean(),
		policyVersion: z.string(),
		evidenceRef: z.string().regex(/^cs:[a-f0-9-]{36}$/),
		expiresAt: z.number().finite()
	})
	.strict();
export function readBrowserConsent(cookies: Cookies, settings: ConsentSettings) {
	try {
		const choice = browserChoiceSchema.parse(JSON.parse(cookies.get('cs_consent') ?? 'null'));
		return choice.policyVersion === settings.policyVersion &&
			choice.expiresAt > Date.now() &&
			choice.expiresAt <= Date.now() + settings.retentionDays * 86400000
			? choice
			: null;
	} catch {
		return null;
	}
}
export function browserStatisticsAllowed(
	cookies: Cookies,
	settings: ConsentSettings = consentSettingsSchema.parse({})
) {
	return (
		settings.ownMeasurement === 'necessary' ||
		readBrowserConsent(cookies, settings)?.statistics === true
	);
}
