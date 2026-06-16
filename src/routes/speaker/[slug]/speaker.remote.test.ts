import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/server', () => ({
	command: (_schema: unknown, handler: (...args: Array<unknown>) => unknown) => handler,
	getRequestEvent: vi.fn()
}));

vi.mock('$lib/server/attribution/campaign-visits', () => ({
	logCampaignVisit: vi.fn()
}));

import { getRequestEvent } from '$app/server';
import { logCampaignVisit } from '$lib/server/attribution/campaign-visits';
import { logSpeakerVisit } from './speaker.remote';

const mockedGetRequestEvent = vi.mocked(getRequestEvent);
const mockedLogCampaignVisit = vi.mocked(logCampaignVisit);

describe('speaker.remote', () => {
	beforeEach(() => {
		mockedGetRequestEvent.mockReset();
		mockedLogCampaignVisit.mockReset();
	});

	it('logs a speaker visit with browser visitor id and query params', async () => {
		mockedGetRequestEvent.mockReturnValueOnce({
			request: new Request('https://example.com/speaker/christoph-holz?utm_source=newsletter', {
				headers: new Headers({
					referer: 'https://example.com/',
					'user-agent': 'vitest'
				})
			})
		} as never);
		mockedLogCampaignVisit.mockResolvedValueOnce({ logged: true });

		const result = await logSpeakerVisit({
			campaignId: 44,
			campaignPageId: 55,
			slug: 'christoph-holz',
			visitorIdentifier: 'visitor-123',
			searchParams: { utm_source: 'newsletter' }
		});

		expect(result).toEqual({ logged: true });
		expect(mockedLogCampaignVisit).toHaveBeenCalledWith(
			expect.objectContaining({
				campaignId: 44,
				campaignPageId: 55,
				slug: 'christoph-holz',
				visitorIdentifier: 'visitor-123'
			})
		);
	});
});
