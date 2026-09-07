import { env } from '$env/dynamic/private';
import { z } from 'zod';
const BASE = 'https://datamanager.googleapis.com/v1';
export class GoogleDeliveryError extends Error {
	constructor(
		public code: string,
		public retryable: boolean
	) {
		super(code);
	}
}
export function googleConfigured() {
	return Boolean(
		env.GOOGLE_DATA_MANAGER_CLIENT_ID &&
		env.GOOGLE_DATA_MANAGER_CLIENT_SECRET &&
		env.GOOGLE_DATA_MANAGER_REFRESH_TOKEN
	);
}
async function token() {
	if (!googleConfigured()) throw new GoogleDeliveryError('google_not_configured', true);
	const r = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		signal: AbortSignal.timeout(10000),
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			client_id: env.GOOGLE_DATA_MANAGER_CLIENT_ID!,
			client_secret: env.GOOGLE_DATA_MANAGER_CLIENT_SECRET!,
			refresh_token: env.GOOGLE_DATA_MANAGER_REFRESH_TOKEN!
		})
	});
	if (!r.ok) throw new GoogleDeliveryError(`oauth_http_${r.status}`, true);
	const data = z.object({ access_token: z.string().min(1) }).parse(await r.json());
	return data.access_token;
}
async function call(path: string, body?: unknown) {
	const access = await token();
	const r = await fetch(BASE + path, {
		method: body ? 'POST' : 'GET',
		signal: AbortSignal.timeout(15000),
		headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
		...(body ? { body: JSON.stringify(body) } : {})
	});
	if (!r.ok)
		throw new GoogleDeliveryError(
			`google_http_${r.status}`,
			r.status === 429 || r.status >= 500 || r.status === 401 || r.status === 403
		);
	return r.json() as Promise<unknown>;
}
export async function ingestConversion(payload: unknown) {
	const data = z
		.object({ requestId: z.string().min(1) })
		.parse(await call('/events:ingest', payload));
	return data.requestId;
}
export async function conversionStatus(requestId: string) {
	const data = z
		.object({
			requestStatusPerDestination: z.array(
				z.object({
					requestStatus: z.string(),
					errorInfo: z.unknown().optional(),
					warningInfo: z.unknown().optional()
				})
			)
		})
		.parse(await call('/requestStatus:retrieve?requestId=' + encodeURIComponent(requestId)));
	const statuses = data.requestStatusPerDestination;
	if (statuses.some((s) => s.requestStatus === 'FAILED' || s.requestStatus === 'PARTIAL_SUCCESS'))
		return { status: 'failed', error: 'google_processing_failed' };
	if (statuses.length && statuses.every((s) => s.requestStatus === 'SUCCESS'))
		return {
			status: 'delivered',
			error: statuses.some((s) => s.warningInfo) ? 'google_processing_warning' : null
		};
	return { status: 'accepted', error: null };
}
