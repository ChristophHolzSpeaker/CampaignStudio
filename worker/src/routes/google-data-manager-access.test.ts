import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../lib/google-auth/jwt', () => ({
	createGoogleJwtAssertion: vi.fn(async () => 'secret-assertion')
}));
import { createGoogleJwtAssertion } from '../lib/google-auth/jwt';
import { handleGoogleDataManagerAccess } from './google-data-manager-access';
const env = {
	SUPABASE_URL: 'https://test.supabase.co',
	SUPABASE_SERVICE_ROLE_KEY: 'test',
	BOOKING_TOKEN_SECRET: 'test',
	INTERNAL_API_TOKEN: 'internal-test',
	GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@jplanding.iam.gserviceaccount.com',
	GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'secret-key'
};
const request = () =>
	new Request('https://worker.test/google/data-manager/access', {
		headers: { Authorization: 'Bearer internal-test' }
	});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});
describe('Google Data Manager access diagnostic', () => {
	it('rejects unauthorized requests before Google access', async () => {
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		expect(
			(await handleGoogleDataManagerAccess(new Request('https://worker.test'), env)).status
		).toBe(401);
		expect(fetch).not.toHaveBeenCalled();
	});
	it('checks account access without delegated identity, uploads or credential disclosure', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ access_token: 'secret-token' }))
			.mockResolvedValueOnce(Response.json({ userLists: [{ displayName: 'private-audience' }] }));
		vi.stubGlobal('fetch', fetch);
		const response = await handleGoogleDataManagerAccess(request(), env);
		const body = await response.text();
		expect(JSON.parse(body)).toMatchObject({
			ok: true,
			projectId: 'jplanding',
			accountReadAccess: true,
			conversionUploadTested: false
		});
		for (const secret of ['secret-key', 'secret-token', 'secret-assertion', 'private-audience'])
			expect(body).not.toContain(secret);
		expect(vi.mocked(createGoogleJwtAssertion).mock.calls[0][0]).not.toHaveProperty(
			'impersonatedUser'
		);
		expect(fetch.mock.calls[1][0]).toContain('/accounts/2354667197/userLists');
		expect(fetch).toHaveBeenCalledTimes(2);
	});
	it('distinguishes disabled API from successful token authentication', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(Response.json({ access_token: 'secret-token' }))
				.mockResolvedValueOnce(
					Response.json(
						{
							error: {
								status: 'PERMISSION_DENIED',
								message: 'do-not-forward',
								details: [
									{
										reason: 'SERVICE_DISABLED',
										metadata: { consumer: 'projects/123', service: 'datamanager.googleapis.com' }
									}
								]
							}
						},
						{ status: 403 }
					)
				)
		);
		const response = await handleGoogleDataManagerAccess(request(), env);
		const body = await response.text();
		expect(body).not.toContain('do-not-forward');
		expect(JSON.parse(body)).toMatchObject({
			ok: false,
			tokenMinted: true,
			httpStatus: 403,
			reasons: [{ reason: 'SERVICE_DISABLED' }]
		});
	});
});
