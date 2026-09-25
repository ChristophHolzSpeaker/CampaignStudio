import { requireCrmWriteRequest, publicApiJson } from '$lib/server/public-api/http';
import { readLimitedJson } from '$lib/server/runtime/http';
import { outcomeSchema } from '$lib/tracking/contract';
import { recordVisitOutcome, OutcomeError, deliveryView } from '$lib/server/tracking/outcomes';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, params }) => {
	const guard = await requireCrmWriteRequest(request);
	if (!guard.ok) return guard.response;
	const reply = (body: unknown, status = 200) =>
		publicApiJson(body, guard.context, { status, headers: { 'Cache-Control': 'no-store' } });
	const id = Number(params.id);
	if (!Number.isSafeInteger(id) || id < 1)
		return reply({ ok: false, error: 'Invalid visit id' }, 400);
	let body;
	try {
		body = await readLimitedJson(request);
	} catch {
		return reply({ ok: false, error: 'Invalid JSON' }, 400);
	}
	const parsed = outcomeSchema.safeParse(body);
	if (!parsed.success)
		return reply({ ok: false, error: 'Invalid outcome', issues: parsed.error.issues }, 400);
	try {
		return reply({ ok: true, data: deliveryView(await recordVisitOutcome(id, parsed.data)) }, 202);
	} catch (e) {
		if (e instanceof OutcomeError)
			return reply({ ok: false, error: e.message, reasons: e.reasons }, e.status);
		throw e;
	}
};
