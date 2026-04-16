import { describe, expect, it } from 'vitest';
import { normalizeGooglePrivateKey, pemToPkcs8 } from './private-key';

describe('google private key helpers', () => {
	it('normalizes escaped newlines to PEM newlines', () => {
		const value = normalizeGooglePrivateKey(
			'-----BEGIN PRIVATE KEY-----\\nQUJD\\n-----END PRIVATE KEY-----'
		);
		expect(value).toContain('\nQUJD\n');
	});

	it('converts pem payload to pkcs8 bytes', () => {
		const bytes = pemToPkcs8('-----BEGIN PRIVATE KEY-----\nQUJD\n-----END PRIVATE KEY-----');
		expect(bytes).toBeInstanceOf(ArrayBuffer);
		expect(new Uint8Array(bytes)).toEqual(new Uint8Array([65, 66, 67]));
	});

	it('throws for malformed pem values', () => {
		expect(() => normalizeGooglePrivateKey('invalid')).toThrow(
			'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY must be a valid PKCS#8 PEM private key'
		);
		expect(() =>
			pemToPkcs8('-----BEGIN PRIVATE KEY-----\n%%%%\n-----END PRIVATE KEY-----')
		).toThrow('Google private key PEM payload is not valid base64');
	});
});
