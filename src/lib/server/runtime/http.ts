import { json } from '@sveltejs/kit';
import { fingerprintToken } from '$lib/server/public-api/auth';
import { enforcePublicApiRateLimit, rateLimitHeaders } from '$lib/server/public-api/rate-limit';

export function enforceSameOrigin(request: Request, url?: URL): Response | null {
	const origin = request.headers.get('origin');
	const expectedOrigin = url?.origin ?? new URL(request.url).origin;
	if (origin !== expectedOrigin)
		return json({ ok: false, error: 'Cross-origin requests are not allowed' }, { status: 403 });
	return null;
}

export async function enforceRuntimeRateLimit(identifier: string): Promise<Response | null> {
	const result = await enforcePublicApiRateLimit(fingerprintToken(`runtime:${identifier}`));
	if (!result.ok)
		return json(
			{ ok: false, error: 'Rate limit exceeded' },
			{
				status: 429,
				headers: { ...rateLimitHeaders(result), 'Retry-After': String(result.retryAfterSeconds) }
			}
		);
	return null;
}

export async function readLimitedJson(request: Request, maxBytes = 16 * 1024): Promise<unknown> {
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > maxBytes) throw new Error('Request body is too large');
	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.byteLength > maxBytes) throw new Error('Request body is too large');
	return JSON.parse(new TextDecoder().decode(bytes));
}
