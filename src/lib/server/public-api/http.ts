import { json } from '@sveltejs/kit';
import { authenticatePublicApiRequest } from './auth';
import { enforcePublicApiRateLimit, rateLimitHeaders, rateLimitResponse } from './rate-limit';

export type PublicApiContext = {
	tokenFingerprint: string;
	rateLimitHeaders: HeadersInit;
};

export async function requirePublicApiRequest(request: Request): Promise<
	| { ok: true; context: PublicApiContext }
	| {
			ok: false;
			response: Response;
	  }
> {
	const auth = authenticatePublicApiRequest(request);
	if (!auth.ok) {
		return {
			ok: false,
			response: json({ ok: false, error: auth.message }, { status: auth.status })
		};
	}

	const rateLimit = await enforcePublicApiRateLimit(auth.tokenFingerprint);
	if (!rateLimit.ok) {
		return { ok: false, response: rateLimitResponse(rateLimit) };
	}

	return {
		ok: true,
		context: {
			tokenFingerprint: auth.tokenFingerprint,
			rateLimitHeaders: rateLimitHeaders(rateLimit)
		}
	};
}

export function publicApiJson(data: unknown, context: PublicApiContext, init: ResponseInit = {}) {
	return json(data, {
		...init,
		headers: {
			...context.rateLimitHeaders,
			...init.headers
		}
	});
}

export function parsePositiveInt(value: string | null, fallback: number, max: number): number {
	if (!value) return fallback;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) return fallback;
	return Math.min(parsed, max);
}

export function parseOptionalDate(value: string | null): Date | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function parseOptionalPositiveInt(value: string | null): number | null {
	if (!value) return null;
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
