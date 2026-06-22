import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { public_api_rate_limits } from '$lib/server/db/schema';

type RateLimitWindow = {
	name: 'minute' | 'day';
	limit: number;
	windowMs: number;
};

type RateLimitResult =
	| {
			ok: true;
			limit: number;
			remaining: number;
			resetAt: Date;
	  }
	| {
			ok: false;
			limit: number;
			remaining: 0;
			resetAt: Date;
			retryAfterSeconds: number;
	  };

const RATE_LIMIT_WINDOWS: RateLimitWindow[] = [
	{ name: 'minute', limit: 60, windowMs: 60_000 },
	{ name: 'day', limit: 1_000, windowMs: 24 * 60 * 60_000 }
];

function getWindowStart(now: Date, windowMs: number): Date {
	return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

function getRetryAfterSeconds(now: Date, resetAt: Date): number {
	return Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1_000));
}

async function incrementWindow(
	tokenFingerprint: string,
	window: RateLimitWindow,
	now: Date
): Promise<RateLimitResult> {
	const windowStart = getWindowStart(now, window.windowMs);
	const resetAt = new Date(windowStart.getTime() + window.windowMs);

	const [row] = await db
		.insert(public_api_rate_limits)
		.values({
			token_fingerprint: tokenFingerprint,
			window_name: window.name,
			window_start: windowStart,
			request_count: 1,
			updated_at: now
		})
		.onConflictDoUpdate({
			target: [
				public_api_rate_limits.token_fingerprint,
				public_api_rate_limits.window_name,
				public_api_rate_limits.window_start
			],
			set: {
				request_count: sql`${public_api_rate_limits.request_count} + 1`,
				updated_at: now
			}
		})
		.returning({ requestCount: public_api_rate_limits.request_count });

	const requestCount = row?.requestCount ?? window.limit + 1;
	const remaining = Math.max(0, window.limit - requestCount);

	if (requestCount > window.limit) {
		return {
			ok: false,
			limit: window.limit,
			remaining: 0,
			resetAt,
			retryAfterSeconds: getRetryAfterSeconds(now, resetAt)
		};
	}

	return { ok: true, limit: window.limit, remaining, resetAt };
}

export async function enforcePublicApiRateLimit(
	tokenFingerprint: string
): Promise<RateLimitResult> {
	const now = new Date();
	const results: RateLimitResult[] = [];

	for (const window of RATE_LIMIT_WINDOWS) {
		results.push(await incrementWindow(tokenFingerprint, window, now));
	}

	const rejected = results.find((result) => !result.ok);
	if (rejected) {
		return rejected;
	}

	return results[0]!;
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
	return {
		'X-RateLimit-Limit': String(result.limit),
		'X-RateLimit-Remaining': String(result.remaining),
		'X-RateLimit-Reset': result.resetAt.toISOString()
	};
}

export function rateLimitResponse(result: Extract<RateLimitResult, { ok: false }>): Response {
	return json(
		{ ok: false, error: 'Rate limit exceeded' },
		{
			status: 429,
			headers: {
				...rateLimitHeaders(result),
				'Retry-After': String(result.retryAfterSeconds)
			}
		}
	);
}
