import { env } from '$env/dynamic/private';

export type WorkerErrorResponse = {
	ok: false;
	error: string;
};

export function requireWorkerEnv(
	name: 'ATTRIBUTION_WORKER_URL' | 'ATTRIBUTION_INTERNAL_TOKEN'
): string {
	const value = env[name];
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
}

export function buildWorkerAuthHeader(): string {
	const token = requireWorkerEnv('ATTRIBUTION_INTERNAL_TOKEN');
	return `Bearer ${token}`;
}

export async function parseWorkerResponse<T>(response: Response): Promise<T> {
	const payload = (await response.json()) as T | WorkerErrorResponse;
	if (!response.ok) {
		const errorMessage =
			typeof payload === 'object' && payload !== null && 'error' in payload
				? payload.error
				: `Worker request failed with status ${response.status}`;
		throw new Error(errorMessage);
	}
	return payload as T;
}
