import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('artifact runtime YouTube widget', () => {
	it('loads only a validated privacy-enhanced YouTube player after activation', async () => {
		const response = await GET({} as never);
		const source = await response.text();

		expect(source).toContain("widget === 'youtube-video'");
		expect(source).toContain('/^[A-Za-z0-9_-]{11}$/.test(videoId)');
		expect(source).toContain('https://www.youtube-nocookie.com/embed/');
		expect(source).toContain("button.addEventListener('click'");
		expect(source).toContain("iframe.referrerPolicy = 'strict-origin-when-cross-origin'");
		expect(source).toContain(
			"iframe.sandbox = 'allow-scripts allow-same-origin allow-presentation'"
		);
	});
});
