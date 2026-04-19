import { logLeadEvent } from '$lib/server/attribution/lead-events';
import { json } from '@sveltejs/kit';
import { z } from 'zod';

const formStartedSchema = z.object({
	campaign_id: z.number().int().positive(),
	campaign_page_id: z.number().int().positive(),
	page_path: z.string().trim().min(1).max(255),
	form_key: z.string().trim().min(1).max(255)
});

export async function POST({ request }: { request: Request }): Promise<Response> {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
	}

	const parsed = formStartedSchema.safeParse(payload);
	if (!parsed.success) {
		return json({ ok: false, error: 'Invalid request payload' }, { status: 400 });
	}

	await logLeadEvent({
		campaignId: parsed.data.campaign_id,
		campaignPageId: parsed.data.campaign_page_id,
		eventType: 'form_started',
		eventSource: 'sveltekit.frictionless_funnel_form',
		eventPayload: {
			form_key: parsed.data.form_key,
			page_path: parsed.data.page_path
		}
	});

	return json({ ok: true });
}
