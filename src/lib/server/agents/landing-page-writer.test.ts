import { describe, expect, it } from 'vitest';
import { includeGeographyInSeoText } from './landing-page-writer';

describe('includeGeographyInSeoText', () => {
	it('appends geography when it is missing', () => {
		expect(includeGeographyInSeoText('AI keynote speaker', 'Germany')).toBe(
			'AI keynote speaker in Germany'
		);
	});

	it('does not append geography when already present', () => {
		expect(includeGeographyInSeoText('AI keynote speaker in Germany', 'Germany')).toBe(
			'AI keynote speaker in Germany'
		);
	});

	it('matches geography case-insensitively', () => {
		expect(includeGeographyInSeoText('AI keynote speaker in germany', 'Germany')).toBe(
			'AI keynote speaker in germany'
		);
	});

	it('returns trimmed base value when geography is empty', () => {
		expect(includeGeographyInSeoText('  AI keynote speaker  ', '   ')).toBe('AI keynote speaker');
	});
});
