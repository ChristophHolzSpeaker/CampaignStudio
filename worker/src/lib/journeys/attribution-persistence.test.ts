import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
	selectOne: vi.fn(),
	updateMany: vi.fn()
}));

import { selectOne, updateMany } from '../db';
import { persistWorkerJourneyAttributionSnapshot } from './attribution-persistence';

const mockedSelectOne = vi.mocked(selectOne);
const mockedUpdateMany = vi.mocked(updateMany);

describe('persistWorkerJourneyAttributionSnapshot', () => {
	beforeEach(() => {
		mockedSelectOne.mockReset();
		mockedUpdateMany.mockReset();
	});

	it('does nothing when journey is not found', async () => {
		mockedSelectOne.mockResolvedValueOnce(null);

		await persistWorkerJourneyAttributionSnapshot({} as never, {
			journeyId: 'journey-1',
			campaignId: 1,
			campaignPageId: 2
		});

		expect(mockedUpdateMany).not.toHaveBeenCalled();
	});

	it('updates last-touch and keeps legacy utm values for non-visit fallback updates', async () => {
		mockedSelectOne
			.mockResolvedValueOnce({
				id: 'journey-1',
				first_seen_at: '2026-05-01T09:00:00.000Z',
				first_visit_id: 10,
				first_campaign_id: 1,
				first_page_id: 2,
				first_utm_source: 'google',
				first_utm_medium: 'cpc',
				first_utm_campaign: 'launch',
				first_referrer: 'https://google.com',
				first_cta_key: null,
				last_seen_at: '2026-05-01T09:30:00.000Z',
				last_visit_id: 11,
				last_campaign_id: 1,
				last_page_id: 2,
				last_utm_source: 'google',
				last_utm_medium: 'cpc',
				last_utm_campaign: 'launch',
				last_referrer: 'https://google.com',
				last_cta_key: null,
				attribution_model_version: 'journey_attribution_v1'
			} as never)
			.mockResolvedValueOnce({ cta_key: null } as never)
			.mockResolvedValueOnce({ cta_key: 'form_primary_submit' } as never);

		await persistWorkerJourneyAttributionSnapshot({} as never, {
			journeyId: 'journey-1',
			campaignId: 1,
			campaignPageId: 2,
			observedAt: new Date('2026-05-01T10:00:00.000Z')
		});

		expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
		const updatePayload = mockedUpdateMany.mock.calls[0]?.[3] as Record<string, unknown>;
		expect(updatePayload.last_visit_id).toBeNull();
		expect(updatePayload.last_utm_source).toBe('google');
		expect(updatePayload.last_utm_medium).toBe('cpc');
		expect(updatePayload.last_utm_campaign).toBe('launch');
		expect(updatePayload.last_referrer).toBe('https://google.com');
		expect(updatePayload.last_cta_key).toBe('form_primary_submit');
	});
});
