import { describe, expect, it } from 'vitest';
import {
	buildPrivacyEnhancedHeroVideoUrl,
	extractYouTubeVideoId,
	isEligibleHeroVideoUrl
} from './hero-video';

describe('hero video experiment eligibility', () => {
	it.each([
		['https://www.youtube.com/watch?v=mpbtCg2NSUs', 'mpbtCg2NSUs'],
		['https://youtu.be/mpbtCg2NSUs', 'mpbtCg2NSUs'],
		['https://www.youtube.com/embed/mpbtCg2NSUs', 'mpbtCg2NSUs'],
		['https://www.youtube.com/shorts/mpbtCg2NSUs', 'mpbtCg2NSUs']
	])('accepts an approved YouTube URL form', (url, expectedId) => {
		expect(extractYouTubeVideoId(url)).toBe(expectedId);
		expect(isEligibleHeroVideoUrl(url)).toBe(true);
	});

	it.each(['', 'not-a-url', 'https://example.com/watch?v=mpbtCg2NSUs'])(
		'rejects an ineligible hero video URL',
		(url) => {
			expect(extractYouTubeVideoId(url)).toBeNull();
			expect(isEligibleHeroVideoUrl(url)).toBe(false);
		}
	);

	it('builds a privacy-enhanced muted looping autoplay embed', () => {
		expect(buildPrivacyEnhancedHeroVideoUrl('https://youtu.be/mpbtCg2NSUs')).toBe(
			'https://www.youtube-nocookie.com/embed/mpbtCg2NSUs?autoplay=1&mute=1&loop=1&playlist=mpbtCg2NSUs&controls=0&playsinline=1&rel=0&enablejsapi=1'
		);
	});
});
