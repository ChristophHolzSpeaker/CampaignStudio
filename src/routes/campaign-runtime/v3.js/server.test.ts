import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('artifact runtime YouTube playback tracking', () => {
	it('tracks the first confirmed player playback as a video CTA', async () => {
		const response = await GET({} as never);
		const source = await response.text();

		expect(source).toContain("context.runtimeVersion !== 'v3'");
		expect(source).toContain('https://www.youtube.com/iframe_api');
		expect(source).toContain('enablejsapi=1&origin=');
		expect(source).toContain('YT.PlayerState.PLAYING');
		expect(source).toContain("type: 'video'");
		expect(source).toContain("cta_key: 'video-' + videoId");
		expect(source).toContain("cta_section: 'videos'");
		expect(source).toContain('if (playbackReported) return;');
	});

	it('uses the video ID as the tracking label fallback', async () => {
		const response = await GET({} as never);
		const source = await response.text();

		expect(source).toContain('|| videoId;');
	});
});
