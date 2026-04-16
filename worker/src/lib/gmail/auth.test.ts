import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerEnv } from '../env';
import { getGmailAccessToken } from './auth';
import { makeTestEnv } from '../../test/helpers';

function makeEnv(overrides?: Partial<WorkerEnv>): WorkerEnv {
	return makeTestEnv({
		GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@example.iam.gserviceaccount.com',
		GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
			'-----BEGIN PRIVATE KEY-----\nQUJD\n-----END PRIVATE KEY-----',
		GOOGLE_IMPERSONATED_USER: 'speaker@christophholz.com',
		GOOGLE_CALENDAR_IMPERSONATED_USER: 'christoph@christophholz.com',
		...overrides
	});
}

describe('getGmailAccessToken', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('mints token using service account jwt flow', async () => {
		vi.spyOn(globalThis.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
		vi.spyOn(globalThis.crypto.subtle, 'sign').mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({ access_token: 'token_abc', expires_in: 3600, token_type: 'Bearer' }),
				{
					status: 200
				}
			)
		);

		const token = await getGmailAccessToken(makeEnv(), 'speaker+test-1@christophholz.com');
		expect(token).toBe('token_abc');
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it('uses cache for same service account + delegated user', async () => {
		vi.spyOn(globalThis.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
		vi.spyOn(globalThis.crypto.subtle, 'sign').mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({ access_token: 'token_cached', expires_in: 3600, token_type: 'Bearer' }),
				{
					status: 200
				}
			)
		);

		const env = makeEnv({
			GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc-cache@example.iam.gserviceaccount.com'
		});
		const delegated = 'speaker+cache@christophholz.com';

		const first = await getGmailAccessToken(env, delegated);
		const second = await getGmailAccessToken(env, delegated);

		expect(first).toBe('token_cached');
		expect(second).toBe('token_cached');
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it('throws when token response misses access_token', async () => {
		vi.spyOn(globalThis.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
		vi.spyOn(globalThis.crypto.subtle, 'sign').mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ expires_in: 3600, token_type: 'Bearer' }), { status: 200 })
		);

		await expect(
			getGmailAccessToken(
				makeEnv({
					GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc-missing@example.iam.gserviceaccount.com'
				}),
				'speaker+missing@christophholz.com'
			)
		).rejects.toThrow('Google token response is missing fields');
	});
});
