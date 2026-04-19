import { trackCTA } from '$lib/server/attribution/client';
import { ctaTypes } from '../../../../../shared/event-types';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const trackCtaRequestSchema = z.object({
	type: z.enum(ctaTypes),
	campaign_id: z.number().int().positive(),
	campaign_page_id: z.number().int().positive(),
	lead_journey_id: z.string().uuid().optional(),
	session_id: z.string().trim().min(1).max(255).optional(),
	anonymous_id: z.string().trim().min(1).max(255).optional(),
	cta_key: z.string().trim().min(1).max(255).optional(),
	cta_label: z.string().trim().min(1).max(255).optional(),
	cta_section: z.string().trim().min(1).max(255).optional(),
	cta_variant: z.string().trim().min(1).max(255).optional()
});

export const POST: RequestHandler = async ({ request }) => {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
	}

	const parsed = trackCtaRequestSchema.safeParse(payload);
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
		await trackCTA(parsed.data);
	} catch (trackingError) {
		console.error('CTA tracking failed', trackingError);
	}

	return new Response(null, { status: 204 });
};
