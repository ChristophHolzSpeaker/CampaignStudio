import { describe, expect, it } from 'vitest';
import { buildSpeakerMailtoHref } from './mailto';

describe('buildSpeakerMailtoHref', () => {
	it('uses the Campaign Studio alias with the campaign page id', () => {
		const href = buildSpeakerMailtoHref({
			campaignPageId: 3
		});

		expect(href).toContain('speakerlp+3@christophholz.com');
	});

	it('uses the Campaign Studio alias without a plus token when page attribution is unavailable', () => {
		const href = buildSpeakerMailtoHref({
			campaignPageId: null
		});

		expect(href).toContain('speakerlp@christophholz.com');
	});
});
