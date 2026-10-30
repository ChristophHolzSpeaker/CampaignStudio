import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../../test/helpers';

vi.mock('../db', () => ({
	insertOne: vi.fn(),
	selectOne: vi.fn()
}));

vi.mock('./attribution-persistence', () => ({
	persistWorkerJourneyAttributionSnapshot: vi.fn()
}));

import { insertOne, selectOne } from '../db';
import { persistWorkerJourneyAttributionSnapshot } from './attribution-persistence';
import { resolveInboundJourney } from './resolve-inbound-journey';

const mockedInsertOne = vi.mocked(insertOne);
const mockedSelectOne = vi.mocked(selectOne);
const mockedPersistAttribution = vi.mocked(persistWorkerJourneyAttributionSnapshot);

describe('resolveInboundJourney', () => {
	beforeEach(() => {
		mockedInsertOne.mockReset();
		mockedSelectOne.mockReset();
		mockedPersistAttribution.mockReset();
	});

	it('starts a customer journey rather than reviving an archived outbound import', async () => {
		mockedSelectOne
			.mockResolvedValueOnce({ lead_journey_id: 'false-import' })
			.mockResolvedValueOnce({
				id: 'false-import',
				contact_email: 'keynote@christophholz.com',
				campaign_id: null,
				campaign_page_id: null,
				outcome: 'outbound_email_import'
			});
		mockedInsertOne.mockResolvedValue({
			id: 'customer-journey',
			contact_email: 'customer@example.org',
			campaign_id: null,
			campaign_page_id: null
		});
		const result = await resolveInboundJourney(makeTestEnv(), {
			providerThreadId: 'outreach-thread',
			normalizedSenderEmail: 'customer@example.org',
			senderDisplayName: 'Customer',
			toRecipients: ['speakerlp@christophholz.com']
		});
		expect(result).toMatchObject({
			lead_journey_id: 'customer-journey',
			created_new_journey: true
		});
		expect(mockedInsertOne).toHaveBeenCalledWith(
			expect.anything(),
			'lead_journeys',
			expect.objectContaining({ contact_email: 'customer@example.org' })
		);
	});
	it('resolves the campaign from the page id in a Campaign Studio alias', async () => {
		mockedSelectOne
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: 55, campaign_id: 12 })
			.mockResolvedValueOnce(null);
		mockedInsertOne.mockResolvedValue({
			id: 'journey_1',
			campaign_id: 12,
			campaign_page_id: 55,
			contact_email: 'jane@example.com',
			updated_at: '2026-07-26T00:00:00.000Z'
		});

		const result = await resolveInboundJourney(makeTestEnv(), {
			providerThreadId: 'thread_1',
			normalizedSenderEmail: 'jane@example.com',
			senderDisplayName: 'Jane',
			toRecipients: ['speakerlp+55@christophholz.com']
		});

		expect(result).toMatchObject({
			campaign_id: 12,
			campaign_page_id: 55,
			attribution_status: 'parsed',
			created_new_journey: true
		});

		const campaignPageQuery = mockedSelectOne.mock.calls[1]?.[2] as URLSearchParams;
		expect(campaignPageQuery.get('id')).toBe('eq.55');
		expect(campaignPageQuery.has('campaign_id')).toBe(false);
		expect(mockedPersistAttribution).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({ campaignId: 12, campaignPageId: 55 })
		);
	});
});
