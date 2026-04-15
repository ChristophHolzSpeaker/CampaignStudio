import { describe, expect, it } from 'vitest';
import { normalizeEmailAddress, normalizeEmailIdentity } from './normalize';

describe('normalize email identity', () => {
	it('normalizes a plain email', () => {
		expect(normalizeEmailAddress(' Person@Example.COM ')).toBe('person@example.com');
	});

	it('extracts and normalizes display-name format', () => {
		expect(normalizeEmailAddress('Person Name <Person@Example.COM>')).toBe('person@example.com');
	});

	it('extracts quoted display-name format with display name', () => {
		expect(normalizeEmailIdentity('"Person Name" <person@example.com>')).toEqual({
			email: 'person@example.com',
			display_name: 'Person Name'
		});
	});

	it('supports mailto prefixes', () => {
		expect(normalizeEmailAddress('mailto:PERSON@EXAMPLE.COM')).toBe('person@example.com');
	});

	it('returns null for invalid input', () => {
		expect(normalizeEmailAddress('not-an-email')).toBeNull();
	});
});
