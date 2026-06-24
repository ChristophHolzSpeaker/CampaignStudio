import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/attribution/campaign-visits', () => ({
	logCampaignVisit: vi.fn(),
	markCampaignVisitEngaged: vi.fn()
}));

import {
	logCampaignVisit,
	markCampaignVisitEngaged
} from '$lib/server/attribution/campaign-visits';
import { logSpeakerVisitFromRequest, markSpeakerVisitEngagedFromRequest } from './speaker-visit';

const mockedLogCampaignVisit = vi.mocked(logCampaignVisit);
const mockedMarkCampaignVisitEngaged = vi.mocked(markCampaignVisitEngaged);

describe('speaker visit request logging', () => {
	beforeEach(() => {
		mockedLogCampaignVisit.mockReset();
		mockedMarkCampaignVisitEngaged.mockReset();
	});

	it('logs a speaker visit with browser visitor id and query params', async () => {
		const headers = new Headers({
			referer: 'https://example.com/',
			'user-agent': 'vitest',
			'x-forwarded-for': '203.0.113.42',
			'x-vercel-ip-country': 'AT',
			'x-vercel-ip-city': 'Vienna'
		});
		mockedLogCampaignVisit.mockResolvedValueOnce({ logged: true, visitId: 88 });

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

		expect(result).toEqual({ logged: true, visitId: 88 });
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

	it('marks a speaker visit engaged with the visit id and visitor id', async () => {
		mockedMarkCampaignVisitEngaged.mockResolvedValueOnce({ marked: true });

		const result = await markSpeakerVisitEngagedFromRequest({
			visitId: 88,
			visitorIdentifier: 'visitor-123',
			durationMs: 10_250
		});

		expect(result).toEqual({ marked: true });
		expect(mockedMarkCampaignVisitEngaged).toHaveBeenCalledWith({
			visitId: 88,
			visitorIdentifier: 'visitor-123',
			durationMs: 10_250
		});
	});
});
