import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBase64Url } from '../../test/helpers';
import { createGoogleJwtAssertion, createGoogleJwtClaims } from './jwt';

describe('google jwt assertion', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('builds claims with expected audience, scope and expiry window', () => {
		const claims = createGoogleJwtClaims({
			serviceAccountEmail: 'svc@example.iam.gserviceaccount.com',
			impersonatedUser: 'speaker@christophholz.com',
			tokenUri: 'https://oauth2.googleapis.com/token',
			scopes: [
				'https://www.googleapis.com/auth/gmail.readonly',
				'https://www.googleapis.com/auth/gmail.send'
			],
			nowMs: 1_716_000_000_000
		});

		expect(claims.iss).toBe('svc@example.iam.gserviceaccount.com');
		expect(claims.sub).toBe('speaker@christophholz.com');
		expect(claims.aud).toBe('https://oauth2.googleapis.com/token');
		expect(claims.scope).toBe(
			'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'
		);
		expect(claims.exp - claims.iat).toBeLessThanOrEqual(3600);
	});

	it('signs header.payload input with RS256', async () => {
		vi.spyOn(globalThis.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
		const signSpy = vi
			.spyOn(globalThis.crypto.subtle, 'sign')
			.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);

		const assertion = await createGoogleJwtAssertion({
			serviceAccountEmail: 'svc@example.iam.gserviceaccount.com',
			impersonatedUser: 'speaker@christophholz.com',
			privateKeyPem: '-----BEGIN PRIVATE KEY-----\\nQUJD\\n-----END PRIVATE KEY-----',
			tokenUri: 'https://oauth2.googleapis.com/token',
			scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
			nowMs: 1_716_000_000_000
		});

		const [header, payload] = assertion.split('.');
		expect(header).toBeDefined();
		expect(payload).toBeDefined();

		const signedInputBytes = signSpy.mock.calls[0]?.[2] as ArrayBuffer;
		const signedInput = new TextDecoder().decode(signedInputBytes);
		expect(signedInput).toBe(`${header}.${payload}`);

		const payloadJson = JSON.parse(decodeBase64Url(payload ?? '')) as Record<string, unknown>;
		expect(payloadJson.sub).toBe('speaker@christophholz.com');
		expect(payloadJson.exp).toBe((payloadJson.iat as number) + 3600);
	});
});
