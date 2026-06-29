import { describe, expect, it } from 'vitest';
import { appendCampaignParamsToChristophLink } from './christophholz-link';

describe('appendCampaignParamsToChristophLink', () => {
	it('preserves existing params and appends campaign ids', () => {
		const result = appendCampaignParamsToChristophLink({
			href: 'https://www.christophholz.com/privacy?foo=bar',
			searchParams: new URLSearchParams('utm_source=newsletter&gclid=abc123'),
			campaignId: 44,
			campaignPageId: 55
		});

		expect(result).toBe(
			'https://www.christophholz.com/privacy?foo=bar&utm_source=newsletter&gclid=abc123&campaignId=44&campaignPageId=55'
		);
	});

	it('leaves non-christoph links unchanged', () => {
		expect(
			appendCampaignParamsToChristophLink({
				href: 'https://example.com/',
				searchParams: new URLSearchParams('utm_source=newsletter'),
				campaignId: 44,
				campaignPageId: 55
			})
		).toBe('https://example.com/');
	});
});
