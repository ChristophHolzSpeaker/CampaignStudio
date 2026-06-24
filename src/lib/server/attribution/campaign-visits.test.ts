import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn()
	}
}));

import { db } from '$lib/server/db';
import { logCampaignVisit, truncateIpAddress } from './campaign-visits';

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
				'user-agent': 'vitest',
				'x-forwarded-for': '203.0.113.42',
				'x-vercel-ip-country': 'AT',
				'x-vercel-ip-city': 'Vienna'
			}),
			visitorIdentifier: 'visitor-123'
		});

		expect(result).toEqual({ logged: false });
		expect(mockedDb.insert).not.toHaveBeenCalled();
	});

	it('writes attribution, truncated ip, and geo fields for a new visit', async () => {
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
				'user-agent': 'vitest',
				'x-forwarded-for': '203.0.113.42, 198.51.100.10',
				'x-vercel-ip-country': 'AT',
				'x-vercel-ip-city': 'Wien%20Neubau'
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
				ip_address: '203.0.113.0',
				country: 'AT',
				city: 'Wien Neubau',
				ip_hash_or_session_identifier: 'visitor-123'
			})
		);
	});

	it('truncates IP addresses before storage', () => {
		expect(truncateIpAddress('203.0.113.42')).toBe('203.0.113.0');
		expect(truncateIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(
			'2001:db8:85a3:0:0:0:0:0'
		);
		expect(truncateIpAddress('not-an-ip')).toBeNull();
	});
});
