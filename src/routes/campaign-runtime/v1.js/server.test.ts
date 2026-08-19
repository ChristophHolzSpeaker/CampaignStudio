import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('artifact runtime booking iframe', () => {
	it('does not apply an ineffective same-origin script sandbox', async () => {
		const response = await GET({} as never);
		const source = await response.text();

		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(source).not.toContain('allow-scripts allow-same-origin');
		expect(source).not.toContain('iframe.sandbox');
	});

	it('reports artifact preview height to an embedding parent', async () => {
		const response = await GET({} as never);
		const source = await response.text();

		expect(source).toContain("type: 'campaignstudio:embed-height'");
		expect(source).toContain('new ResizeObserver(reportHeight)');
		expect(source).toContain('context.preview && parent !== window');
	});
});
