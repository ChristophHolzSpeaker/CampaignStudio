import { createSignedBookingToken } from '../crypto';
import { insertOne, selectOne } from '../db';
import { requireEnv, type WorkerEnv } from '../env';
import { logLeadEvent } from '../analytics/lead-events';

const DEFAULT_BOOKING_TTL_SECONDS = 60 * 60 * 24 * 30;

type LeadJourneyRow = {
	id: string;
	campaign_id: number | null;
};

type BookingLinkRow = {
	id: string;
	token: string;
	expires_at: string;
};

export type CreateBookingLinkResult = {
	booking_link_id: string;
	url: string;
	token: string;
	expires_at: string;
	campaign_id: number;
};

function resolveBookingBaseUrl(env: WorkerEnv): URL {
	return new URL(env.BOOKING_BASE_URL ?? 'https://book.domain.com/');
}

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

export async function createBookingLinkForJourney(
	env: WorkerEnv,
	input: {
		lead_journey_id: string;
		campaign_id?: number | null;
		event_source: string;
	}
): Promise<CreateBookingLinkResult> {
	const journeyQuery = new URLSearchParams({
		select: 'id,campaign_id',
		id: `eq.${input.lead_journey_id}`,
		limit: '1'
	});
	const journey = await selectOne<LeadJourneyRow>(env, 'lead_journeys', journeyQuery);
	if (!journey) {
		throw new Error('Lead journey not found');
	}

	if (
		journey.campaign_id !== null &&
		input.campaign_id !== undefined &&
		input.campaign_id !== null &&
		input.campaign_id !== journey.campaign_id
	) {
		throw new Error('campaign_id does not match lead journey campaign_id');
	}

	const campaignId = input.campaign_id ?? journey.campaign_id;
	if (campaignId === null) {
		throw new Error('Unable to resolve campaign_id from lead_journey_id');
	}

	const now = Math.floor(Date.now() / 1000);
	const exp = now + resolveBookingTtlSeconds(env);
	const expiresAt = new Date(exp * 1000).toISOString();

	const token = await createSignedBookingToken(
		{
			lead_journey_id: input.lead_journey_id,
			campaign_id: campaignId,
			iat: now,
			exp
		},
		requireEnv(env, 'BOOKING_TOKEN_SECRET')
	);

	const created = await insertOne<BookingLinkRow>(env, 'booking_links', {
		lead_journey_id: input.lead_journey_id,
		campaign_id: campaignId,
		token,
		expires_at: expiresAt
	});

	await logLeadEvent(env, {
		lead_journey_id: input.lead_journey_id,
		campaign_id: campaignId,
		campaign_page_id: null,
		event_type: 'booking_link_created',
		event_source: input.event_source,
		event_payload: {
			legacy_event_type: 'booking_link_generated',
			booking_link_id: created.id,
			expires_at: expiresAt
		}
	});

	const bookingBase = resolveBookingBaseUrl(env);
	const bookingUrl = new URL(`/book/l/${encodeURIComponent(token)}`, bookingBase);

	return {
		booking_link_id: created.id,
		url: bookingUrl.toString(),
		token,
		expires_at: expiresAt,
		campaign_id: campaignId
	};
}
