import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn()
	}
}));

import { db } from '$lib/server/db';
import { getSpeakerHeroMediaAttribution } from './ab-testing';

const mockedDb = vi.mocked(db);

describe('speaker hero media conversion attribution', () => {
	beforeEach(() => {
		mockedDb.select.mockReset();
	});

	it('resolves the running assignment by visitor ID', async () => {
		const limit = vi.fn().mockResolvedValueOnce([
			{
				experimentId: '11111111-1111-4111-8111-111111111111',
				variantId: '22222222-2222-4222-8222-222222222222'
			}
		]);
		mockedDb.select.mockReturnValueOnce({
			from: () => ({
				innerJoin: () => ({
					innerJoin: () => ({
						where: () => ({ limit })
					})
				})
			})
		} as never);

		await expect(getSpeakerHeroMediaAttribution('visitor-123')).resolves.toEqual({
			experimentId: '11111111-1111-4111-8111-111111111111',
			variantId: '22222222-2222-4222-8222-222222222222'
		});
	});

	it('does not query for a missing visitor ID', async () => {
		await expect(getSpeakerHeroMediaAttribution(null)).resolves.toBeNull();
		expect(mockedDb.select).not.toHaveBeenCalled();
	});
});
