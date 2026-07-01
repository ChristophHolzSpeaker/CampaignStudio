import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn()
	}
}));

import { db } from '$lib/server/db';
import { logCampaignVisit, markCampaignVisitEngaged } from './campaign-visits';

const mockedDb = vi.mocked(db);

describe('logCampaignVisit', () => {
	beforeEach(() => {
		mockedDb.select.mockReset();
		mockedDb.insert.mockReset();
		mockedDb.update.mockReset();
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
				'user-agent': 'vitest',
				'x-forwarded-for': '203.0.113.42',
				'x-vercel-ip-country': 'AT',
				'x-vercel-ip-city': 'Vienna'
			}),
			visitorIdentifier: 'visitor-123'
		});

		expect(result).toEqual({ logged: false, visitId: 1 });
		expect(mockedDb.insert).not.toHaveBeenCalled();
	});

	it('writes attribution, full ip, and geo fields for a new visit', async () => {
		const where = vi.fn().mockReturnThis();
		const limit = vi.fn().mockResolvedValueOnce([]);
		const returning = vi.fn().mockResolvedValueOnce([{ id: 88 }]);
		const values = vi.fn().mockReturnValueOnce({ returning });

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
				'user-agent': 'vitest',
				'x-forwarded-for': '203.0.113.42, 198.51.100.10',
				'x-vercel-ip-country': 'AT',
				'x-vercel-ip-city': 'Wien%20Neubau'
			}),
			visitorIdentifier: 'visitor-123'
		});

		expect(result).toEqual({ logged: true, visitId: 88 });
		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				campaign_id: 44,
				campaign_page_id: 55,
				slug: 'christoph-holz',
				referrer: 'https://example.com/',
				utm_source: 'newsletter',
				utm_medium: 'email',
				user_agent: 'vitest',
				ip_address: '203.0.113.42',
				country: 'AT',
				city: 'Wien Neubau',
				ip_hash_or_session_identifier: 'visitor-123'
			})
		);
		expect(returning).toHaveBeenCalled();
	});

	it('marks a visit engaged only for the matching visitor identifier', async () => {
		const returning = vi.fn().mockResolvedValueOnce([{ id: 88 }]);
		const where = vi.fn().mockReturnValueOnce({ returning });
		const set = vi.fn().mockReturnValueOnce({ where });

		mockedDb.update.mockReturnValueOnce({ set } as never);

		const result = await markCampaignVisitEngaged({
			visitId: 88,
			visitorIdentifier: 'visitor-123',
			durationMs: 10_500.9
		});

		expect(result).toEqual({ marked: true });
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				bounced: false,
				engagement_duration_ms: 10500
			})
		);
		expect(where).toHaveBeenCalled();
	});

	it('writes the first x-forwarded-for IP for full storage', async () => {
		const where = vi.fn().mockReturnThis();
		const limit = vi.fn().mockResolvedValueOnce([]);
		const returning = vi.fn().mockResolvedValueOnce([{ id: 88 }]);
		const values = vi.fn().mockReturnValueOnce({ returning });

		mockedDb.select.mockReturnValueOnce({
			from: () => ({
				where,
				limit
			})
		} as never);
		mockedDb.insert.mockReturnValueOnce({
			values
		} as never);

		await logCampaignVisit({
			campaignId: 44,
			campaignPageId: 55,
			slug: 'christoph-holz',
			searchParams: new URLSearchParams('utm_source=newsletter'),
			headers: new Headers({
				referer: 'https://example.com/',
				'user-agent': 'vitest',
				'x-forwarded-for': '198.51.100.77, 203.0.113.42',
				'x-vercel-ip-country': 'DE',
				'x-vercel-ip-city': 'Berlin'
			}),
			visitorIdentifier: 'visitor-123'
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				ip_address: '198.51.100.77'
			})
		);
	});
});
