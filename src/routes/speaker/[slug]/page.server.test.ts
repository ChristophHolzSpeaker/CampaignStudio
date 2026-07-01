import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/page-builder/page', () => ({
	parseLandingPageDocument: vi.fn()
}));

vi.mock('$lib/server/attribution/mailto', () => ({
	buildSpeakerMailtoHref: vi.fn()
}));

vi.mock('$lib/server/ab-testing', () => ({
	resolveSpeakerPrimaryCtaAbTest: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn()
	}
}));

import { parseLandingPageDocument } from '$lib/page-builder/page';
import { resolveSpeakerPrimaryCtaAbTest } from '$lib/server/ab-testing';
import { buildSpeakerMailtoHref } from '$lib/server/attribution/mailto';
import { db } from '$lib/server/db';
import { load } from './+page.server';

const mockedParseLandingPageDocument = vi.mocked(parseLandingPageDocument);
const mockedBuildSpeakerMailtoHref = vi.mocked(buildSpeakerMailtoHref);
const mockedResolveSpeakerPrimaryCtaAbTest = vi.mocked(resolveSpeakerPrimaryCtaAbTest);
const mockedDb = vi.mocked(db);

describe('/speaker/[slug] +page.server', () => {
	beforeEach(() => {
		mockedParseLandingPageDocument.mockReset();
		mockedBuildSpeakerMailtoHref.mockReset();
		mockedResolveSpeakerPrimaryCtaAbTest.mockReset();
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
		mockedResolveSpeakerPrimaryCtaAbTest.mockResolvedValueOnce({
			experimentId: null,
			experimentKey: 'speaker_primary_cta_v1',
			variantId: null,
			variantKey: 'A',
			visitorId: 'visitor-123',
			ctaMode: 'booking_calendar'
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
});
