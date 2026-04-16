import { describe, expect, it } from 'vitest';
import { makeTestEnv } from '../../test/helpers';
import { DEFAULT_GOOGLE_TOKEN_URI, parseGoogleAuthEnv } from './env';

describe('parseGoogleAuthEnv', () => {
	it('parses required values and defaults token uri', () => {
		const config = parseGoogleAuthEnv(
			makeTestEnv({
				GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@example.iam.gserviceaccount.com',
				GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
					'-----BEGIN PRIVATE KEY-----\\nQUJD\\n-----END PRIVATE KEY-----',
				GOOGLE_IMPERSONATED_USER: 'speaker@christophholz.com',
				GOOGLE_CALENDAR_IMPERSONATED_USER: 'christoph@christophholz.com'
			})
		);

		expect(config.serviceAccountEmail).toBe('svc@example.iam.gserviceaccount.com');
		expect(config.tokenUri).toBe(DEFAULT_GOOGLE_TOKEN_URI);
		expect(config.gmailImpersonatedUser).toBe('speaker@christophholz.com');
		expect(config.calendarImpersonatedUser).toBe('christoph@christophholz.com');
	});

	it('throws on missing required env var', () => {
		expect(() =>
			parseGoogleAuthEnv(
				makeTestEnv({
					GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
						'-----BEGIN PRIVATE KEY-----\\nQUJD\\n-----END PRIVATE KEY-----',
					GOOGLE_IMPERSONATED_USER: 'speaker@christophholz.com',
					GOOGLE_CALENDAR_IMPERSONATED_USER: 'christoph@christophholz.com'
				})
			)
		).toThrow('Missing required env var: GOOGLE_SERVICE_ACCOUNT_EMAIL');
	});

	it('throws when impersonated user is invalid', () => {
		expect(() =>
			parseGoogleAuthEnv(
				makeTestEnv({
					GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@example.iam.gserviceaccount.com',
					GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
						'-----BEGIN PRIVATE KEY-----\\nQUJD\\n-----END PRIVATE KEY-----',
					GOOGLE_IMPERSONATED_USER: 'not-an-email',
					GOOGLE_CALENDAR_IMPERSONATED_USER: 'christoph@christophholz.com'
				})
			)
		).toThrow('Invalid email in env var: GOOGLE_IMPERSONATED_USER');
	});
});
