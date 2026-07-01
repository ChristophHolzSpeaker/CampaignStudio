import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { ab_events } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const abEventSchema = z.object({
	eventType: z.enum(['cta_click']),
	experimentId: z.string().uuid(),
	variantId: z.string().uuid(),
	visitorId: z.string().trim().min(1).max(255),
	route: z.string().trim().min(1).max(255),
	slug: z.string().trim().min(1).max(255),
	sessionId: z.string().trim().min(1).max(255).optional(),
	metadata: z.record(z.string(), z.unknown()).optional()
});

export const POST: RequestHandler = async ({ request }) => {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
	}

	const parsed = abEventSchema.safeParse(payload);
	if (!parsed.success) {
		return json(
			{
				ok: false,
				error: 'Validation failed',
				details: parsed.error.flatten()
			},
			{ status: 400 }
		);
	}

	try {
		await db.insert(ab_events).values({
			experiment_id: parsed.data.experimentId,
			variant_id: parsed.data.variantId,
			visitor_id: parsed.data.visitorId,
			session_id: parsed.data.sessionId ?? null,
			event_type: parsed.data.eventType,
			route: parsed.data.route,
			slug: parsed.data.slug,
			metadata: parsed.data.metadata ?? {}
		});
	} catch (error) {
		console.error('AB event capture failed', error);
	}

	return new Response(null, { status: 204 });
};
