import { z } from 'zod';
import { db } from '$lib/server/db';
import { conversion_deliveries } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import {
	requirePublicApiRequest,
	requireCrmWriteRequest,
	publicApiJson
} from '$lib/server/public-api/http';
import { deliveryView } from '$lib/server/tracking/outcomes';
import type { RequestHandler } from './$types';
const handle: RequestHandler = async ({ request, params }) => {
	const guard = await (request.method === 'GET'
		? requirePublicApiRequest(request)
		: requireCrmWriteRequest(request));
	if (!guard.ok) return guard.response;
	const reply = (data: unknown, status = 200) =>
		publicApiJson(data, guard.context, { status, headers: { 'Cache-Control': 'no-store' } });
	if (!z.uuid().safeParse(params.id).success)
		return reply({ ok: false, error: 'Invalid delivery id' }, 400);
	const [row] = await db
		.select()
		.from(conversion_deliveries)
		.where(eq(conversion_deliveries.id, params.id))
		.limit(1);
	if (!row) return reply({ ok: false, error: 'Delivery not found' }, 404);
	if (request.method === 'GET') return reply({ ok: true, data: deliveryView(row) });
	// Explicit retry retains the original transaction, attribution and destination snapshot.
	if (row.status !== 'failed')
		return reply({ ok: false, error: 'Only failed deliveries may be retried' }, 409);
	const [updated] = await db
		.update(conversion_deliveries)
		.set({
			status: row.google_request_id ? 'accepted' : 'pending',
			attempts: 0,
			next_attempt_at: new Date(),
			last_error: null,
			updated_at: new Date()
		})
		.where(and(eq(conversion_deliveries.id, row.id), eq(conversion_deliveries.status, 'failed')))
		.returning();
	return updated
		? reply({ ok: true, data: deliveryView(updated) }, 202)
		: reply({ ok: false, error: 'Delivery changed; read again' }, 409);
};
export const GET = handle;
export const POST = handle;
