import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/attribution/client', () => ({
	trackCTA: vi.fn()
}));

vi.mock('$lib/server/attribution/campaign-visits', () => ({
	readVisitorIdentifier: vi.fn(),
	resolveCampaignVisitId: vi.fn()
}));

vi.mock('$lib/server/attribution/campaign-context', () => ({
	resolvePublishedCampaignPageContext: vi.fn()
}));

import { trackCTA } from '$lib/server/attribution/client';
import {
	readVisitorIdentifier,
	resolveCampaignVisitId
} from '$lib/server/attribution/campaign-visits';
import { resolvePublishedCampaignPageContext } from '$lib/server/attribution/campaign-context';
import { POST } from './+server';

const mockedTrackCTA = vi.mocked(trackCTA);
const mockedReadVisitorIdentifier = vi.mocked(readVisitorIdentifier);
const mockedResolveCampaignVisitId = vi.mocked(resolveCampaignVisitId);
const mockedResolvePublishedCampaignPageContext = vi.mocked(resolvePublishedCampaignPageContext);

function requestWithBody(body: unknown): Request {
	return new Request('http://localhost/api/attribution/cta', {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: 'http://localhost' },
		body: JSON.stringify(body)
	});
}

describe('POST /api/attribution/cta', () => {
	beforeEach(() => {
		mockedTrackCTA.mockReset();
		mockedReadVisitorIdentifier.mockReset();
		mockedResolveCampaignVisitId.mockReset();
		mockedReadVisitorIdentifier.mockReturnValue('visitor-123');
		mockedResolveCampaignVisitId.mockResolvedValue(77);
		mockedResolvePublishedCampaignPageContext.mockResolvedValue({
			campaignId: 10,
			campaignPageId: 3
		});
	});

	it('returns 400 for invalid CTA type', async () => {
		const response = await POST({
			request: requestWithBody({ type: 'invalid', campaign_id: 1, campaign_page_id: 2 })
		} as never);

		expect(response.status).toBe(400);
		expect(mockedTrackCTA).not.toHaveBeenCalled();
	});

	it('accepts navigation CTA payload and sends navigation type', async () => {
		const response = await POST({
			request: requestWithBody({
				type: 'navigation',
				campaign_id: 10,
				campaign_page_id: 3,
				cta_key: 'landing_navigation_home',
				cta_label: 'Home',
				cta_section: 'landing_navigation',
				cta_variant: 'desktop'
			}),
			cookies: {} as never
		} as never);

		expect(response.status).toBe(204);
		expect(mockedTrackCTA).toHaveBeenCalledTimes(1);
		expect(mockedTrackCTA).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'navigation',
				campaign_id: 10,
				campaign_page_id: 3,
				campaign_visit_id: 77,
				anonymous_id: 'visitor-123',
				cta_key: 'landing_navigation_home',
				cta_section: 'landing_navigation'
			})
		);
		expect(mockedResolveCampaignVisitId).toHaveBeenCalledWith({
			campaignId: 10,
			campaignPageId: 3,
			visitorIdentifier: 'visitor-123',
			requestedVisitId: undefined
		});
	});
});
