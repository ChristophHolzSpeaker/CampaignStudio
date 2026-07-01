import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/attribution/client', () => ({
	trackCTA: vi.fn()
}));

import { trackCTA } from '$lib/server/attribution/client';
import { POST } from './+server';

const mockedTrackCTA = vi.mocked(trackCTA);

function requestWithBody(body: unknown): Request {
	return new Request('http://localhost/api/attribution/cta', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('POST /api/attribution/cta', () => {
	beforeEach(() => {
		mockedTrackCTA.mockReset();
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
			})
		} as never);

		expect(response.status).toBe(204);
		expect(mockedTrackCTA).toHaveBeenCalledTimes(1);
		expect(mockedTrackCTA).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'navigation',
				campaign_id: 10,
				campaign_page_id: 3,
				cta_key: 'landing_navigation_home',
				cta_section: 'landing_navigation'
			})
		);
	});
});
