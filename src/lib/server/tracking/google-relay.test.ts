import { afterEach, describe, expect, it, vi } from 'vitest';
const { env } = vi.hoisted(() => ({
	env: {
		GOOGLE_DATA_MANAGER_WORKER_URL: 'https://worker.example',
		GOOGLE_DATA_MANAGER_WORKER_TOKEN: 'relay-secret'
	}
}));
vi.mock('$env/dynamic/private', () => ({ env }));
import { ingestConversion, conversionStatus, googleConfigured } from './google';
afterEach(() => {
	vi.unstubAllGlobals();
	env.GOOGLE_DATA_MANAGER_WORKER_URL = 'https://worker.example';
});
describe('app service-account transport', () => {
	it('sends only to the protected worker and does not request user OAuth', async () => {
		const fetch = vi.fn(async () => Response.json({ requestId: 'request' }));
		vi.stubGlobal('fetch', fetch);
		expect(googleConfigured()).toBe(true);
		expect(await ingestConversion({ events: [] })).toBe('request');
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			new URL('https://worker.example/google/conversions/ingest'),
			expect.objectContaining({
				redirect: 'error',
				headers: { Authorization: 'Bearer relay-secret', 'Content-Type': 'application/json' }
			})
		);
	});
	it('uses POST for diagnostic request IDs without embedding them in the relay URL', async () => {
		const fetch = vi.fn(async () =>
			Response.json({ requestStatusPerDestination: [{ requestStatus: 'SUCCESS' }] })
		);
		vi.stubGlobal('fetch', fetch);
		expect((await conversionStatus('request/with?special')).status).toBe('delivered');
		expect(fetch).toHaveBeenCalledWith(
			new URL('https://worker.example/google/conversions/status'),
			expect.objectContaining({ body: JSON.stringify({ requestId: 'request/with?special' }) })
		);
	});
	it('rejects insecure transport configuration', async () => {
		env.GOOGLE_DATA_MANAGER_WORKER_URL = 'http://worker.example';
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		expect(googleConfigured()).toBe(false);
		await expect(ingestConversion({})).rejects.toMatchObject({
			code: 'google_relay_not_configured'
		});
		expect(fetch).not.toHaveBeenCalled();
	});
});
