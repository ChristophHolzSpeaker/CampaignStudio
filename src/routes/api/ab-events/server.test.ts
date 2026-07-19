import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {
		insert: vi.fn()
	}
}));

import { db } from '$lib/server/db';
import { POST } from './+server';

const mockedDb = vi.mocked(db);

describe('POST /api/ab-events', () => {
	beforeEach(() => {
		mockedDb.insert.mockReset();
	});

	it.each(['experiment_exposure', 'video_ready', 'video_error', 'page_performance'] as const)(
		'accepts the %s experiment event',
		async (eventType) => {
			const values = vi.fn().mockResolvedValue(undefined);
			mockedDb.insert.mockReturnValueOnce({ values } as never);

			const response = await POST({
				request: new Request('https://example.com/api/ab-events', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						eventType,
						experimentId: '11111111-1111-4111-8111-111111111111',
						variantId: '22222222-2222-4222-8222-222222222222',
						visitorId: 'visitor-123',
						campaignPageId: 42,
						route: '/speaker/christoph-holz',
						slug: 'christoph-holz'
					})
				})
			} as never);

			expect(response.status).toBe(204);
			expect(values).toHaveBeenCalledWith(
				expect.objectContaining({ event_type: eventType, campaign_page_id: 42 })
			);
		}
	);
});
