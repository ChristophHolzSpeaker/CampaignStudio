import { z } from 'zod';
import { createSignedBookingToken } from '../lib/crypto';
import { insertOne, selectOne } from '../lib/db';
import { requireEnv, type WorkerEnv } from '../lib/env';
import { badRequestFromZod, json } from '../lib/http';

const DEFAULT_BOOKING_TTL_SECONDS = 60 * 60 * 24 * 30;

const bookingLinkSchema = z.object({
	lead_journey_id: z.string().uuid(),
	campaign_id: z.coerce.number().int().positive().optional()
});

type LeadJourneyRow = {
	id: string;
	campaign_id: number | null;
};

function resolveBookingTtlSeconds(env: WorkerEnv): number {
	const configured = env.BOOKING_LINK_TTL_SECONDS;
	if (!configured) {
		return DEFAULT_BOOKING_TTL_SECONDS;
	}
	const parsed = Number(configured);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_BOOKING_TTL_SECONDS;
	}
	return Math.floor(parsed);
}

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
	const journeyQuery = new URLSearchParams({
		select: 'id,campaign_id',
		id: `eq.${input.lead_journey_id}`,
		limit: '1'
	});
	const journey = await selectOne<LeadJourneyRow>(env, 'lead_journeys', journeyQuery);
	if (!journey) {
		return json({ ok: false, error: 'Lead journey not found' }, 404);
	}

	let campaignId = journey.campaign_id;
	if (campaignId === null && input.campaign_id !== undefined) {
		campaignId = input.campaign_id;
	}

	if (
		journey.campaign_id !== null &&
		input.campaign_id !== undefined &&
		input.campaign_id !== journey.campaign_id
	) {
		return json({ ok: false, error: 'campaign_id does not match lead journey campaign_id' }, 400);
	}

	if (campaignId === null) {
		return json({ ok: false, error: 'Unable to resolve campaign_id from lead_journey_id' }, 400);
	}

	const now = Math.floor(Date.now() / 1000);
	const exp = now + resolveBookingTtlSeconds(env);
	const token = await createSignedBookingToken(
		{
			lead_journey_id: input.lead_journey_id,
			campaign_id: campaignId,
			iat: now,
			exp
		},
		requireEnv(env, 'BOOKING_TOKEN_SECRET')
	);

	await insertOne(env, 'booking_links', {
		lead_journey_id: input.lead_journey_id,
		campaign_id: campaignId,
		token,
		expires_at: new Date(exp * 1000).toISOString()
	});

	await insertOne(env, 'lead_events', {
		lead_journey_id: input.lead_journey_id,
		campaign_id: campaignId,
		campaign_page_id: null,
		event_type: 'booking_link_generated',
		event_source: 'worker.booking_link',
		event_payload: {
			expires_at: new Date(exp * 1000).toISOString()
		}
	});

	const bookingBase = env.BOOKING_BASE_URL ?? 'https://book.domain.com/';
	const bookingUrl = new URL(bookingBase);
	bookingUrl.searchParams.set('token', token);

	return json({
		ok: true,
		url: bookingUrl.toString(),
		token,
		expires_at: new Date(exp * 1000).toISOString()
	});
}
