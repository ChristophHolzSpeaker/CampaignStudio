import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn()
	}
}));

vi.mock('$lib/server/attribution/campaign-visits', () => ({
	getOrCreateVisitorIdentifier: vi.fn(() => 'visitor-123')
}));

import { db } from '$lib/server/db';
import { getSpeakerHeroMediaAttribution, resolveSpeakerHeroMediaExperiment } from './ab-testing';

const mockedDb = vi.mocked(db);

describe('speaker hero media conversion attribution', () => {
	beforeEach(() => {
		mockedDb.select.mockReset();
		mockedDb.insert.mockReset();
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

describe('speaker hero media assignment', () => {
	beforeEach(() => {
		mockedDb.select.mockReset();
		mockedDb.insert.mockReset();
	});

	it('lets a valid manual cookie override update a stored assignment', async () => {
		const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
		const values = vi.fn(() => ({ onConflictDoUpdate }));
		mockedDb.insert.mockReturnValueOnce({ values } as never);

		mockedDb.select
			.mockReturnValueOnce({
				from: () => ({
					where: () => ({
						limit: async () => [{ id: 'experiment-1', key: 'speaker_hero_autoplay_video_v1' }]
					})
				})
			} as never)
			.mockReturnValueOnce({
				from: () => ({
					where: () => ({
						orderBy: async () => [
							{
								id: 'variant-a',
								experimentId: 'experiment-1',
								key: 'A',
								name: 'Static image',
								weight: 50,
								config: { hero_media_mode: 'static_image' },
								isControl: true
							},
							{
								id: 'variant-b',
								experimentId: 'experiment-1',
								key: 'B',
								name: 'Autoplay video',
								weight: 50,
								config: { hero_media_mode: 'autoplay_video' },
								isControl: false
							}
						]
					})
				})
			} as never)
			.mockReturnValueOnce({
				from: () => ({
					where: () => ({ limit: async () => [{ variantId: 'variant-a' }] })
				})
			} as never);

		const cookies = {
			get: vi.fn((name: string) => (name === 'cs_ab_speaker_hero_autoplay_video_v1' ? 'B' : null)),
			set: vi.fn()
		};

		await expect(
			resolveSpeakerHeroMediaExperiment({
				cookies: cookies as never,
				secureCookie: true,
				videoEmbedUrl: 'https://youtu.be/mpbtCg2NSUs'
			})
		).resolves.toEqual(
			expect.objectContaining({
				variantId: 'variant-b',
				variantKey: 'B',
				heroMediaMode: 'autoplay_video'
			})
		);

		expect(onConflictDoUpdate).toHaveBeenCalledWith(
			expect.objectContaining({ set: { variant_id: 'variant-b' } })
		);
	});
});
