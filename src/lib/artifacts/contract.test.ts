import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RESERVED_ARTIFACT_SLUGS, isArtifactSlug, normalizeArtifactPath } from './contract';

describe('artifact slug contract', () => {
	it('accepts canonical public slugs', () => {
		expect(isArtifactSlug('future-ready-leadership')).toBe(true);
	});

	it.each(RESERVED_ARTIFACT_SLUGS)('reserves the application route %s', (slug) => {
		expect(isArtifactSlug(slug)).toBe(false);
	});

	it.each(['UPPERCASE', '-leading', 'trailing-', 'two_words', 'a'.repeat(64)])(
		'rejects invalid slug %s',
		(slug) => expect(isArtifactSlug(slug)).toBe(false)
	);
});

it('reserves every static top-level application route', () => {
	const routesDirectory = fileURLToPath(new URL('../../routes', import.meta.url));
	const groupedRoutes = ['(app)', '(auth)'];
	const topLevel = readdirSync(routesDirectory, { withFileTypes: true })
		.filter(
			(entry) => entry.isDirectory() && !entry.name.startsWith('(') && !entry.name.startsWith('[')
		)
		.map((entry) => entry.name);
	for (const group of groupedRoutes) {
		topLevel.push(
			...readdirSync(`${routesDirectory}/${group}`, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name)
		);
	}
	expect(topLevel.filter(isArtifactSlug)).toEqual([]);
});

describe('artifact path normalization', () => {
	it('normalizes Windows separators', () => {
		expect(normalizeArtifactPath('assets\\hero.webp')).toBe('assets/hero.webp');
	});

	it.each(['/index.html', '../index.html', 'assets//hero.webp', 'assets/../hero.webp'])(
		'rejects unsafe path %s',
		(path) => expect(() => normalizeArtifactPath(path)).toThrow()
	);
});
