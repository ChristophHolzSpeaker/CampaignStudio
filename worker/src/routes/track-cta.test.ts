import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/db', () => ({
	selectOne: vi.fn()
}));

vi.mock('../lib/analytics/lead-events', () => ({
	logLeadEvent: vi.fn()
}));

import { selectOne } from '../lib/db';
import { logLeadEvent } from '../lib/analytics/lead-events';
import { handleTrackCTA } from './track-cta';
import { makeTestEnv } from '../test/helpers';

const mockedSelectOne = vi.mocked(selectOne);
const mockedLogLeadEvent = vi.mocked(logLeadEvent);

function makeRequest(url: string): Request {
	return new Request(url);
}

describe('handleTrackCTA', () => {
	beforeEach(() => {
		mockedSelectOne.mockReset();
		mockedLogLeadEvent.mockReset();
	});

	it('returns 400 when request query is invalid', async () => {
		const response = await handleTrackCTA(
			makeRequest('https://worker.test/track/cta?type=invalid&campaign_id=1&campaign_page_id=2'),
			makeTestEnv()
		);

		expect(response.status).toBe(400);
		expect(mockedSelectOne).not.toHaveBeenCalled();
	});

	it('maps navigation CTA to cta_click event in lead event payload', async () => {
		mockedSelectOne.mockResolvedValueOnce({
			id: 5,
			campaign_id: 10
		});
		mockedLogLeadEvent.mockResolvedValue(undefined as unknown as void);

		const response = await handleTrackCTA(
			makeRequest(
				'https://worker.test/track/cta?type=navigation&campaign_id=10&campaign_page_id=5&cta_key=landing_navigation_category_keynote-speaker_link&cta_label=Keynote%20Speaker&cta_section=landing_navigation&cta_variant=desktop'
			),
			makeTestEnv()
		);

		expect(response.status).toBe(200);
		expect(mockedLogLeadEvent).toHaveBeenCalledTimes(1);
		expect(mockedLogLeadEvent).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({
				event_type: 'cta_click',
				cta_key: 'landing_navigation_category_keynote-speaker_link',
				cta_label: 'Keynote Speaker',
				cta_section: 'landing_navigation',
				cta_variant: 'desktop',
				event_payload: expect.objectContaining({
					cta_type: 'navigation',
					legacy_event_type: 'navigation_cta_click'
				})
			})
		);
	});
});
