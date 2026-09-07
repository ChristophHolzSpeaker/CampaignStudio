import type { WorkerEnv } from './env';
export async function triggerConversionProcessing(env: WorkerEnv): Promise<void> {
	if (!env.CONVERSION_PROCESSOR_URL || !env.CONVERSION_PROCESSOR_TOKEN) return;
	try {
		const url = new URL(env.CONVERSION_PROCESSOR_URL);
		if (url.protocol !== 'https:' || url.username || url.password)
			throw new Error('Invalid processor URL');
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${env.CONVERSION_PROCESSOR_TOKEN}` },
			redirect: 'error',
			signal: AbortSignal.timeout(45000)
		});
		if (!response.ok) console.error('conversion_processing_failed', { status: response.status });
	} catch {
		console.error('conversion_processing_request_failed');
	}
}
