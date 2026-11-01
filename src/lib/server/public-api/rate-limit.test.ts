import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
	env: { CAMPAIGN_WRITE_API_TOKEN: 'write-token' as string | undefined },
	counts: { minute: 0, day: 0 }
}));
vi.mock('$env/dynamic/private', () => ({ env: state.env }));
vi.mock('$lib/server/db', () => ({
	db: {
		insert: () => ({
			values: ({ window_name }: { window_name: 'minute' | 'day' }) => ({
				onConflictDoUpdate: () => ({
					returning: async () => [{ requestCount: ++state.counts[window_name] }]
				})
			})
		})
	}
}));
import { enforcePublicApiRateLimit, rateLimitResponse } from './rate-limit';

const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex');

beforeEach(() => {
	state.env.CAMPAIGN_WRITE_API_TOKEN = 'write-token';
	state.counts = { minute: 0, day: 0 };
});

describe('public API rate limits', () => {
	it('allows the write token past 1,000 requests and rejects after 5,000', async () => {
		state.counts.day = 1_000;
		expect((await enforcePublicApiRateLimit(fingerprint('write-token'))).ok).toBe(true);
		state.counts.day = 5_000;
		const result = await enforcePublicApiRateLimit(fingerprint('write-token'));
		expect(result).toMatchObject({ ok: false, limit: 5_000, remaining: 0 });
		if (!result.ok) expect(rateLimitResponse(result).headers.get('X-RateLimit-Limit')).toBe('5000');
	});

	it('keeps other tokens at 1,000 per day and fails closed when no write token is configured', async () => {
		state.counts.day = 1_000;
		expect(await enforcePublicApiRateLimit(fingerprint('read-token'))).toMatchObject({
			ok: false,
			limit: 1_000
		});
		state.env.CAMPAIGN_WRITE_API_TOKEN = undefined;
		state.counts.day = 1_000;
		expect(await enforcePublicApiRateLimit(fingerprint('write-token'))).toMatchObject({
			ok: false,
			limit: 1_000
		});
	});

	it('retains the minute limit for the write token', async () => {
		state.counts.minute = 60;
		expect(await enforcePublicApiRateLimit(fingerprint('write-token'))).toMatchObject({
			ok: false,
			limit: 60
		});
	});
});
