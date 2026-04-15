import { z } from 'zod';
import { type WorkerEnv } from '../lib/env';
import { badRequestFromZod, json } from '../lib/http';
import { createBookingLinkForJourney } from '../lib/booking/create-booking-link';

const bookingLinkSchema = z.object({
	lead_journey_id: z.string().uuid(),
	campaign_id: z.coerce.number().int().positive().optional()
});

export async function handleBookingLink(request: Request, env: WorkerEnv): Promise<Response> {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const parsedInput = bookingLinkSchema.safeParse(payload);
	if (!parsedInput.success) {
		return badRequestFromZod(parsedInput.error);
	}

	const input = parsedInput.data;
	try {
		const created = await createBookingLinkForJourney(env, {
			lead_journey_id: input.lead_journey_id,
			campaign_id: input.campaign_id,
			event_source: 'worker.booking_link'
		});

		return json({
			ok: true,
			url: created.url,
			token: created.token,
			expires_at: created.expires_at
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unexpected error';
		if (message === 'Lead journey not found') {
			return json({ ok: false, error: message }, 404);
		}
		if (message.includes('campaign_id')) {
			return json({ ok: false, error: message }, 400);
		}
		return json({ ok: false, error: message }, 500);
	}
}
