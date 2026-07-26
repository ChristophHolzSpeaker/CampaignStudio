import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../test/helpers';

vi.mock('../lib/db', () => ({
	insertOne: vi.fn(),
	selectOne: vi.fn(),
	updateMany: vi.fn()
}));

vi.mock('../lib/analytics/lead-events', () => ({
	logLeadEvent: vi.fn()
}));

vi.mock('../lib/journeys/attribution-persistence', () => ({
	persistWorkerJourneyAttributionSnapshot: vi.fn()
}));

import { insertOne, selectOne } from '../lib/db';
import { handleEmailInbound } from './email-inbound';

const mockedInsertOne = vi.mocked(insertOne);
const mockedSelectOne = vi.mocked(selectOne);

describe('handleEmailInbound', () => {
	beforeEach(() => {
		mockedInsertOne.mockReset();
		mockedSelectOne.mockReset();
	});

	it('attributes a Campaign Studio alias by campaign page id', async () => {
		mockedSelectOne.mockResolvedValueOnce({ id: 55, campaign_id: 12 }).mockResolvedValueOnce(null);
		mockedInsertOne.mockResolvedValue({
			id: 'journey_1',
			campaign_id: 12,
			campaign_page_id: 55,
			contact_email: 'jane@example.com',
			current_stage: 'new',
			updated_at: '2026-07-26T00:00:00.000Z'
		});

		const response = await handleEmailInbound(
			new Request('https://worker.test/email/inbound', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					to: 'speakerlp+55@christophholz.com',
					from: 'jane@example.com',
					subject: 'Speaking inquiry',
					body: 'Can Christoph speak at our event?'
				})
			}),
			makeTestEnv()
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			ok: true,
			lead_journey_id: 'journey_1',
			attribution_status: 'parsed'
		});

		const campaignPageQuery = mockedSelectOne.mock.calls[0]?.[2] as URLSearchParams;
		expect(campaignPageQuery.get('id')).toBe('eq.55');
		expect(campaignPageQuery.has('campaign_id')).toBe(false);
		expect(mockedInsertOne).toHaveBeenCalledWith(
			expect.any(Object),
			'lead_journeys',
			expect.objectContaining({ campaign_id: 12, campaign_page_id: 55 })
		);
	});
});
