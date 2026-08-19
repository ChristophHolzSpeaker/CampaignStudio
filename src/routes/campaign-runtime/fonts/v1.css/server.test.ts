import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('artifact platform fonts', () => {
	it('publishes the landing-page font families and authoring variables', async () => {
		const response = await GET({} as never);
		const css = await response.text();

		expect(response.headers.get('content-type')).toContain('text/css');
		expect(css).toContain("font-family: 'Bureau Grot'");
		expect(css).toContain("font-family: 'Bureau Grot Compressed'");
		expect(css).toContain("--cs-font-sans: 'Bureau Grot'");
		expect(css).toContain("--cs-font-display: 'Bureau Grot Compressed'");
	});
});
