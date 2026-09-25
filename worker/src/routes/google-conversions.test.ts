import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../test/helpers';
vi.mock('../lib/google-auth/jwt', () => ({ createGoogleJwtAssertion: vi.fn(async () => 'jwt') }));
import { createGoogleJwtAssertion } from '../lib/google-auth/jwt';
import { handleGoogleConversions } from './google-conversions';
const payload = {
	destinations: [
		{
			operatingAccount: { accountType: 'GOOGLE_ADS', accountId: '2354667197' },
			productDestinationId: '123'
		}
	],
	events: [
		{
			transactionId: 'event-id',
			eventTimestamp: '2026-09-25T00:00:00Z',
			adIdentifiers: { gclid: 'test-click' },
			consent: { adUserData: 'CONSENT_GRANTED' }
		}
	]
};
const env = makeTestEnv({
	GOOGLE_DATA_MANAGER_TOKEN: 'ads-token',
	GOOGLE_SERVICE_ACCOUNT_EMAIL: 'service@example.iam.gserviceaccount.com',
	GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'private',
	GOOGLE_IMPERSONATED_USER: 'gmail@example.com'
});
const request = (path: string, token = 'ads-token', body: unknown = payload) =>
	new Request('https://worker.example/google/conversions/' + path, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
describe('service-account conversion relay', () => {
	const fetchMock = vi.fn();
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('fetch', fetchMock);
	});
	afterEach(() => vi.unstubAllGlobals());
	it('rejects a normal internal token and never calls Google', async () => {
		expect((await handleGoogleConversions(request('ingest', 'test'), env)).status).toBe(401);
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it('validates without uploading and omits Gmail delegated identity', async () => {
		fetchMock
			.mockResolvedValueOnce(Response.json({ access_token: 'secret-token' }))
			.mockResolvedValueOnce(Response.json({}));
		const response = await handleGoogleConversions(request('validate'), env);
		expect(await response.json()).toEqual({ validated: true });
		expect(createGoogleJwtAssertion).toHaveBeenCalledWith(
			expect.objectContaining({ scopes: ['https://www.googleapis.com/auth/datamanager'] })
		);
		expect(vi.mocked(createGoogleJwtAssertion).mock.calls[0][0]).not.toHaveProperty(
			'impersonatedUser'
		);
		expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
			validateOnly: true,
			events: [expect.objectContaining({ eventSource: 'OTHER' })]
		});
		expect(fetchMock.mock.calls[1][0]).toBe('https://datamanager.googleapis.com/v1/events:ingest');
		expect(fetchMock.mock.calls[1][1].redirect).toBe('manual');
	});
	it('returns accepted request ID separately from validation', async () => {
		fetchMock
			.mockResolvedValueOnce(Response.json({ access_token: 'secret-token' }))
			.mockResolvedValueOnce(Response.json({ requestId: 'request-1' }));
		expect(await (await handleGoogleConversions(request('ingest'), env)).json()).toEqual({
			requestId: 'request-1'
		});
		expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ validateOnly: false });
	});
	it('rejects arbitrary fields and denied consent before token creation', async () => {
		expect(
			(
				await handleGoogleConversions(
					request('ingest', 'ads-token', { ...payload, url: 'https://evil.example' }),
					env
				)
			).status
		).toBe(400);
		expect(
			(
				await handleGoogleConversions(
					request('ingest', 'ads-token', {
						...payload,
						events: [{ ...payload.events[0], consent: { adUserData: 'CONSENT_DENIED' } }]
					}),
					env
				)
			).status
		).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it('does not follow redirects or expose Google error bodies', async () => {
		fetchMock
			.mockResolvedValueOnce(Response.json({ access_token: 'secret-token' }))
			.mockResolvedValueOnce(new Response('sensitive body', { status: 403 }));
		const response = await handleGoogleConversions(request('ingest'), env);
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'google_http_403' });
	});
	it('redacts identifiers and credentials in structured Google diagnostics', async () => {
		fetchMock
			.mockResolvedValueOnce(Response.json({ access_token: 'secret-token' }))
			.mockResolvedValueOnce(
				Response.json(
					{
						error: {
							status: 'INVALID_ARGUMENT',
							message: 'Invalid test-click from person@example.com',
							details: [
								{
									reason: 'INVALID_CLICK',
									metadata: { value: 'test-click', authorization: 'secret-token' }
								}
							]
						}
					},
					{ status: 400 }
				)
			);
		const response = await handleGoogleConversions(request('validate'), env);
		const data = await response.text();
		expect(data).toContain('INVALID_CLICK');
		expect(data).not.toContain('test-click');
		expect(data).not.toContain('secret-token');
		expect(data).not.toContain('person@example.com');
	});
});
