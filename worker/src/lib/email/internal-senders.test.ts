import { describe, expect, it } from 'vitest';
import type { WorkerEnv } from '../env';
import { isInternalSender } from './internal-senders';

function makeEnv(domains?: string): WorkerEnv {
	return {
		SUPABASE_URL: 'http://localhost:54321',
		SUPABASE_SERVICE_ROLE_KEY: 'test',
		BOOKING_TOKEN_SECRET: 'test',
		INTERNAL_API_TOKEN: 'test',
		INTERNAL_TEAM_EMAIL_DOMAINS: domains
	};
}

describe('internal sender domain matching', () => {
	it('matches configured domains case-insensitively', () => {
		const env = makeEnv('christophholz.com,internal.example.com');
		expect(isInternalSender(env, 'person@Christophholz.com')).toBe(true);
	});

	it('supports configured domains with @ prefix', () => {
		const env = makeEnv('@christophholz.com');
		expect(isInternalSender(env, 'person@christophholz.com')).toBe(true);
	});

	it('returns false when sender domain is not configured', () => {
		const env = makeEnv('christophholz.com');
		expect(isInternalSender(env, 'person@external.com')).toBe(false);
	});

	it('returns false when config is missing or sender email invalid', () => {
		expect(isInternalSender(makeEnv(undefined), 'person@christophholz.com')).toBe(false);
		expect(isInternalSender(makeEnv('christophholz.com'), 'invalid-email')).toBe(false);
	});
});
