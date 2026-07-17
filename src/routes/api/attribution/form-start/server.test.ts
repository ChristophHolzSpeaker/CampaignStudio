import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/attribution/lead-events', () => ({
	logLeadEvent: vi.fn()
}));

vi.mock('$lib/server/attribution/campaign-visits', () => ({
	readVisitorIdentifier: vi.fn(),
	resolveCampaignVisitId: vi.fn()
}));

import { logLeadEvent } from '$lib/server/attribution/lead-events';
import {
	readVisitorIdentifier,
	resolveCampaignVisitId
} from '$lib/server/attribution/campaign-visits';
import { POST } from './+server';

const mockedLogLeadEvent = vi.mocked(logLeadEvent);
const mockedReadVisitorIdentifier = vi.mocked(readVisitorIdentifier);
const mockedResolveCampaignVisitId = vi.mocked(resolveCampaignVisitId);

describe('POST /api/attribution/form-start', () => {
	beforeEach(() => {
		mockedLogLeadEvent.mockReset();
		mockedReadVisitorIdentifier.mockReset();
		mockedResolveCampaignVisitId.mockReset();
		mockedReadVisitorIdentifier.mockReturnValue('visitor-123');
		mockedResolveCampaignVisitId.mockResolvedValue(77);
	});

	it('returns 400 for invalid payload', async () => {
		const response = await POST({
			request: new Request('http://test.local/api/attribution/form-start', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ campaign_id: 1 })
			}),
			cookies: {} as never
		} as never);

		expect(response.status).toBe(400);
		expect(mockedLogLeadEvent).not.toHaveBeenCalled();
	});

	it('logs canonical form_started event', async () => {
		const response = await POST({
			request: new Request('http://test.local/api/attribution/form-start', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					campaign_id: 10,
					campaign_page_id: 3,
					page_path: '/speaker/example',
					form_key: 'frictionless_booking_request'
				})
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mockedLogLeadEvent).toHaveBeenCalledTimes(1);
		expect(mockedLogLeadEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: 'form_started',
				campaignVisitId: 77,
				anonymousId: 'visitor-123',
				campaignId: 10,
				campaignPageId: 3,
				eventSource: 'sveltekit.frictionless_funnel_form'
			})
		);
	});
});
