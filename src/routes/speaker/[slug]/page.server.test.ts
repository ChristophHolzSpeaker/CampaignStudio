import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/page-builder/page', () => ({
	parseLandingPageDocument: vi.fn()
}));

vi.mock('$lib/server/attribution/mailto', () => ({
	buildSpeakerMailtoHref: vi.fn(),
	DEFAULT_SPEAKER_EMAIL_SUBJECT: 'Vortragsanfrage'
}));

vi.mock('$lib/server/ab-testing', () => ({
	resolveSpeakerHeroMediaExperiment: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn()
	}
}));

import { parseLandingPageDocument } from '$lib/page-builder/page';
import { resolveSpeakerHeroMediaExperiment } from '$lib/server/ab-testing';
import { buildSpeakerMailtoHref } from '$lib/server/attribution/mailto';
import { db } from '$lib/server/db';
import { load } from './+page.server';

const mockedParseLandingPageDocument = vi.mocked(parseLandingPageDocument);
const mockedBuildSpeakerMailtoHref = vi.mocked(buildSpeakerMailtoHref);
const mockedResolveSpeakerHeroMediaExperiment = vi.mocked(resolveSpeakerHeroMediaExperiment);
const mockedDb = vi.mocked(db);

describe('/speaker/[slug] +page.server', () => {
	beforeEach(() => {
		mockedParseLandingPageDocument.mockReset();
		mockedBuildSpeakerMailtoHref.mockReset();
		mockedResolveSpeakerHeroMediaExperiment.mockReset();
		mockedDb.select.mockReset();
	});

	it('returns the page shell without requiring cookies or visit logging', async () => {
		mockedDb.select.mockReturnValueOnce({
			from: () => ({
				innerJoin: () => ({
					where: () => ({
						limit: async () => [
							{
								structuredContentJson: {
									title: 'Speaker page',
									sections: []
								},
								campaignId: 44,
								campaignPageId: 55
							}
						]
					})
				})
			})
		} as never);
		mockedParseLandingPageDocument.mockReturnValueOnce({
			title: 'Speaker page',
			sections: []
		} as never);
		mockedResolveSpeakerHeroMediaExperiment.mockResolvedValueOnce({
			experimentId: null,
			experimentKey: 'speaker_hero_autoplay_video_v1',
			variantId: null,
			variantKey: 'A',
			visitorId: 'visitor-123',
			heroMediaMode: 'static_image'
		});
		mockedBuildSpeakerMailtoHref.mockReturnValueOnce('mailto:christoph@example.com');

		const result = (await load({
			params: { slug: 'christoph-holz' },
			url: new URL('https://example.com/speaker/christoph-holz'),
			cookies: {
				get: () => null,
				set: vi.fn()
			} as never,
			request: new Request('https://example.com/speaker/christoph-holz')
		} as never)) as Record<string, unknown>;

		expect(result.page).toBeTruthy();
		expect(result.speakerMailtoHref).toBe('mailto:christoph@example.com');
		expect(result.abTest).toBeTruthy();
		expect('bookingSlotGroups' in result).toBe(false);
	});

	it('passes the selected hero video URL into experiment eligibility resolution', async () => {
		mockedDb.select.mockReturnValueOnce({
			from: () => ({
				innerJoin: () => ({
					where: () => ({
						limit: async () => [
							{
								structuredContentJson: {},
								campaignId: 44,
								campaignPageId: 55
							}
						]
					})
				})
			})
		} as never);
		mockedParseLandingPageDocument.mockReturnValueOnce({
			title: 'Speaker page',
			sections: [
				{
					type: 'immediate_authority_hero',
					props: {
						headline: 'Keynote speaker',
						subheadline: 'Speaker page description',
						primaryCtaLabel: 'Enquire',
						videoEmbedUrl: 'https://youtu.be/mpbtCg2NSUs',
						videoThumbnailUrl: 'https://example.com/poster.jpg',
						videoThumbnailAlt: 'Christoph speaking'
					}
				}
			]
		} as never);
		mockedResolveSpeakerHeroMediaExperiment.mockResolvedValueOnce({
			experimentId: '11111111-1111-4111-8111-111111111111',
			experimentKey: 'speaker_hero_autoplay_video_v1',
			variantId: '22222222-2222-4222-8222-222222222222',
			variantKey: 'B',
			visitorId: 'visitor-123',
			heroMediaMode: 'autoplay_video'
		});
		mockedBuildSpeakerMailtoHref.mockReturnValueOnce('mailto:christoph@example.com');

		await load({
			params: { slug: 'christoph-holz' },
			url: new URL('https://example.com/speaker/christoph-holz'),
			cookies: { get: () => null, set: vi.fn() } as never,
			request: new Request('https://example.com/speaker/christoph-holz')
		} as never);

		expect(mockedResolveSpeakerHeroMediaExperiment).toHaveBeenCalledWith(
			expect.objectContaining({ videoEmbedUrl: 'https://youtu.be/mpbtCg2NSUs' })
		);
	});
});
