import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('$env/dynamic/private', () => ({
	env: {
		GOOGLE_DATA_MANAGER_CLIENT_ID: 'test',
		GOOGLE_DATA_MANAGER_CLIENT_SECRET: 'test',
		GOOGLE_DATA_MANAGER_REFRESH_TOKEN: 'test'
	}
}));
import { ingestConversion, conversionStatus } from './google';
describe('Data Manager delivery', () => {
	const mock = vi.fn();
	beforeEach(() => {
		mock.mockReset();
		vi.stubGlobal('fetch', mock);
		mock.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test' })));
	});
	afterEach(() => vi.unstubAllGlobals());
	it('requires a Google request ID, not merely HTTP 200', async () => {
		mock.mockResolvedValueOnce(new Response('{}'));
		await expect(ingestConversion({ events: [] })).rejects.toThrow();
	});
	it('sends to Data Manager and returns the accepted request ID', async () => {
		mock.mockResolvedValueOnce(new Response(JSON.stringify({ requestId: 'request-1' })));
		expect(await ingestConversion({ events: [] })).toBe('request-1');
		expect(mock.mock.calls[1][0]).toBe('https://datamanager.googleapis.com/v1/events:ingest');
	});
	it('does not treat processing or partial success as delivered', async () => {
		mock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ requestStatusPerDestination: [{ requestStatus: 'PARTIAL_SUCCESS' }] })
			)
		);
		expect((await conversionStatus('request-1')).status).toBe('failed');
	});
	it('marks confirmed ingestion success separately from initial acceptance', async () => {
		mock.mockResolvedValueOnce(
			new Response(JSON.stringify({ requestStatusPerDestination: [{ requestStatus: 'SUCCESS' }] }))
		);
		expect((await conversionStatus('request-1')).status).toBe('delivered');
	});
});
