import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn()
	}
}));

import { db } from '$lib/server/db';
import { logCampaignVisit } from './campaign-visits';

const mockedDb = vi.mocked(db);

describe('logCampaignVisit', () => {
	beforeEach(() => {
		mockedDb.select.mockReset();
		mockedDb.insert.mockReset();
	});

	it('dedupes repeated visits in the window', async () => {
		const where = vi.fn().mockReturnThis();
		const limit = vi.fn().mockResolvedValueOnce([{ id: 1 }]);

		mockedDb.select.mockReturnValueOnce({
			from: () => ({
				where,
				limit
			})
		} as never);

		const result = await logCampaignVisit({
			campaignId: 44,
			campaignPageId: 55,
			slug: 'christoph-holz',
			searchParams: new URLSearchParams('utm_source=newsletter'),
			headers: new Headers({
				referer: 'https://example.com/',
				'user-agent': 'vitest'
			}),
			visitorIdentifier: 'visitor-123'
		});

		expect(result).toEqual({ logged: false });
		expect(mockedDb.insert).not.toHaveBeenCalled();
	});

	it('writes attribution fields for a new visit', async () => {
		const where = vi.fn().mockReturnThis();
		const limit = vi.fn().mockResolvedValueOnce([]);
		const values = vi.fn().mockResolvedValueOnce(undefined);

		mockedDb.select.mockReturnValueOnce({
			from: () => ({
				where,
				limit
			})
		} as never);
		mockedDb.insert.mockReturnValueOnce({
			values
		} as never);

		const result = await logCampaignVisit({
			campaignId: 44,
			campaignPageId: 55,
			slug: 'christoph-holz',
			searchParams: new URLSearchParams('utm_source=newsletter&utm_medium=email'),
			headers: new Headers({
				referer: 'https://example.com/',
				'user-agent': 'vitest'
			}),
			visitorIdentifier: 'visitor-123'
		});

		expect(result).toEqual({ logged: true });
		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				campaign_id: 44,
				campaign_page_id: 55,
				slug: 'christoph-holz',
				referrer: 'https://example.com/',
				utm_source: 'newsletter',
				utm_medium: 'email',
				user_agent: 'vitest',
				ip_hash_or_session_identifier: 'visitor-123'
			})
		);
	});
});
