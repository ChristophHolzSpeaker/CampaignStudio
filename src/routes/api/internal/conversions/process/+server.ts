import { env } from '$env/dynamic/private';
import { timingSafeEqual } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { processConversions } from '$lib/server/tracking/outcomes';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ request }) => {
	const actual = Buffer.from(request.headers.get('authorization') ?? '');
	const expected = Buffer.from(`Bearer ${env.CRON_SECRET ?? ''}`);
	if (!env.CRON_SECRET || actual.length !== expected.length || !timingSafeEqual(actual, expected))
		return json({ ok: false }, { status: 401 });
	return json(
		{ ok: true, data: await processConversions() },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
