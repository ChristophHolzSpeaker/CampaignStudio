import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/attribution/campaign-visits', () => ({
	logCampaignVisit: vi.fn()
}));

import { logCampaignVisit } from '$lib/server/attribution/campaign-visits';
import { logSpeakerVisitFromRequest } from './speaker-visit';

const mockedLogCampaignVisit = vi.mocked(logCampaignVisit);

describe('speaker visit request logging', () => {
	beforeEach(() => {
		mockedLogCampaignVisit.mockReset();
	});

	it('logs a speaker visit with browser visitor id and query params', async () => {
		const headers = new Headers({
			referer: 'https://example.com/',
			'user-agent': 'vitest',
			'x-forwarded-for': '203.0.113.42',
			'x-vercel-ip-country': 'AT',
			'x-vercel-ip-city': 'Vienna'
		});
		mockedLogCampaignVisit.mockResolvedValueOnce({ logged: true });

		const result = await logSpeakerVisitFromRequest(
			{
				campaignId: 44,
				campaignPageId: 55,
				slug: 'christoph-holz',
				visitorIdentifier: 'visitor-123',
				searchParams: { utm_source: 'newsletter' }
			},
			headers
		);

		expect(result).toEqual({ logged: true });
		expect(mockedLogCampaignVisit).toHaveBeenCalledWith(
			expect.objectContaining({
				campaignId: 44,
				campaignPageId: 55,
				slug: 'christoph-holz',
				visitorIdentifier: 'visitor-123',
				headers
			})
		);
	});
});
