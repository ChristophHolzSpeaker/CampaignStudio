import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBase64Url, makeTestEnv } from '../../test/helpers';
import {
	clearGoogleTokenCacheForTests,
	exchangeGoogleJwtForAccessToken,
	getCalendarAccessToken,
	getGmailAccessToken,
	getGoogleAccessToken
} from './token';

function makeEnv() {
	return makeTestEnv({
		GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@example.iam.gserviceaccount.com',
		GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
			'-----BEGIN PRIVATE KEY-----\\nQUJD\\n-----END PRIVATE KEY-----',
		GOOGLE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
		GOOGLE_IMPERSONATED_USER: 'speaker@christophholz.com',
		GOOGLE_CALENDAR_IMPERSONATED_USER: 'christoph@christophholz.com'
	});
}

function readAssertionSub(fetchCall: unknown): string {
	const init = fetchCall as { body?: BodyInit | null };
	const params = new URLSearchParams(String(init.body));
	const assertion = params.get('assertion') ?? '';
	const payloadPart = assertion.split('.')[1] ?? '';
	const payloadJson = JSON.parse(decodeBase64Url(payloadPart)) as Record<string, unknown>;
	return String(payloadJson.sub);
}

describe('google token exchange', () => {
	beforeEach(() => {
		clearGoogleTokenCacheForTests();
		vi.restoreAllMocks();
	});

	it('posts jwt bearer grant body to token endpoint', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({ access_token: 'token_abc', expires_in: 3600, token_type: 'Bearer' }),
				{
					status: 200
				}
			)
		);

		await exchangeGoogleJwtForAccessToken(
			'https://oauth2.googleapis.com/token',
			'header.payload.signature'
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('https://oauth2.googleapis.com/token');
		const body = String(fetchSpy.mock.calls[0]?.[1]?.body);
		expect(body).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
		expect(body).toContain('assertion=header.payload.signature');
	});

	it('mints token for explicit impersonated user via generic helper', async () => {
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

		const token = await getGoogleAccessToken(
			makeEnv(),
			['https://www.googleapis.com/auth/gmail.send'],
			'speaker+alias@christophholz.com'
		);

		expect(token).toBe('token_abc');
		expect(readAssertionSub(fetchSpy.mock.calls[0]?.[1] ?? null)).toBe(
			'speaker+alias@christophholz.com'
		);
	});

	it('uses GOOGLE_IMPERSONATED_USER in gmail helper', async () => {
		vi.spyOn(globalThis.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
		vi.spyOn(globalThis.crypto.subtle, 'sign').mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({ access_token: 'token_gmail', expires_in: 3600, token_type: 'Bearer' }),
				{
					status: 200
				}
			)
		);

		await getGmailAccessToken(makeEnv());

		expect(readAssertionSub(fetchSpy.mock.calls[0]?.[1] ?? null)).toBe('speaker@christophholz.com');
	});

	it('uses GOOGLE_CALENDAR_IMPERSONATED_USER in calendar helper', async () => {
		vi.spyOn(globalThis.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
		vi.spyOn(globalThis.crypto.subtle, 'sign').mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					access_token: 'token_calendar',
					expires_in: 3600,
					token_type: 'Bearer'
				}),
				{ status: 200 }
			)
		);

		await getCalendarAccessToken(makeEnv());

		expect(readAssertionSub(fetchSpy.mock.calls[0]?.[1] ?? null)).toBe(
			'christoph@christophholz.com'
		);
	});

	it('throws with structured details for token endpoint errors', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ error: 'unauthorized_client' }), { status: 401 })
		);

		await expect(
			exchangeGoogleJwtForAccessToken('https://oauth2.googleapis.com/token', 'bad')
		).rejects.toMatchObject({
			name: 'GoogleAuthError',
			code: 'TOKEN_EXCHANGE_FAILED',
			details: {
				status: 401,
				response: { error: 'unauthorized_client' }
			}
		});
	});
});
