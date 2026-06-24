import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));

function readProjectFile(path: string): string {
	return readFileSync(new URL(path, `file://${projectRoot}`), 'utf8');
}

describe('speaker route analytics scope', () => {
	it('injects Vercel Analytics only in the speaker page', () => {
		const speakerPage = readProjectFile('src/routes/speaker/[slug]/+page.svelte');
		const rootLayout = readProjectFile('src/routes/+layout.svelte');

		expect(speakerPage).toContain('@vercel/analytics/sveltekit');
		expect(speakerPage).toContain('injectAnalytics()');
		expect(speakerPage).toContain('ENGAGEMENT_THRESHOLD_MS = 10_000');
		expect(speakerPage).toContain('markSpeakerVisitEngaged');
		expect(rootLayout).not.toContain('@vercel/analytics');
		expect(rootLayout).not.toContain('injectAnalytics');
		expect(rootLayout).not.toContain('markSpeakerVisitEngaged');
	});
});
