import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('artifact platform fonts v2', () => {
	it('continues to publish the landing-page font families and authoring variables', async () => {
		const response = await GET({} as never);
		const css = await response.text();

		expect(css).toContain("font-family: 'Bureau Grot'");
		expect(css).toContain("--cs-font-display: 'Bureau Grot Compressed'");
	});
});
