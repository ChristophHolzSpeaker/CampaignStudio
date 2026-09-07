import { afterEach, describe, it, expect, vi } from 'vitest';
import type { WorkerEnv } from './env';
import { triggerConversionProcessing } from './conversions';
afterEach(() => vi.unstubAllGlobals());
describe('conversion scheduler', () => {
	it('does not call an unconfigured processor', async () => {
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		await triggerConversionProcessing({} as WorkerEnv);
		expect(fetch).not.toHaveBeenCalled();
	});
	it('uses only the configured HTTPS endpoint and prevents redirecting credentials', async () => {
		const fetch = vi.fn(async () => new Response('{}'));
		vi.stubGlobal('fetch', fetch);
		await triggerConversionProcessing({
			CONVERSION_PROCESSOR_URL: 'https://app.example/api/internal/conversions/process',
			CONVERSION_PROCESSOR_TOKEN: 'test'
		} as WorkerEnv);
		expect(fetch).toHaveBeenCalledWith(
			new URL('https://app.example/api/internal/conversions/process'),
			expect.objectContaining({ headers: { Authorization: 'Bearer test' }, redirect: 'error' })
		);
	});
});
