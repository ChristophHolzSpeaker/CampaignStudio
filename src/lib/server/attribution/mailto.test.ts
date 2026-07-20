import { describe, expect, it } from 'vitest';
import { buildSpeakerMailtoHref } from './mailto';

describe('buildSpeakerMailtoHref', () => {
	it('includes the experiment alias when campaign attribution is available', () => {
		const href = buildSpeakerMailtoHref({
			campaignId: 12,
			campaignPageId: 3,
			experiment: { alias: 'hero1', variantKey: 'B' }
		});

		expect(href).toContain('speaker+cmp12_cp3_abhero1_B@christophholz.com');
	});

	it('does not emit an experiment-only alias without campaign attribution', () => {
		const href = buildSpeakerMailtoHref({
			campaignId: null,
			campaignPageId: null,
			experiment: { alias: 'hero1', variantKey: 'B' }
		});

		expect(href).toContain('speaker@christophholz.com');
		expect(href).not.toContain('_abhero1_B');
	});
});
