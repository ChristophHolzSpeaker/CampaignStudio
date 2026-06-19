import type { CTAEventInput } from '../../../../shared/attribution';
import {
	buildWorkerAuthHeader,
	parseWorkerResponse,
	requireWorkerEnv
} from '$lib/server/worker/internal-client';

type WorkerSuccessResponse = {
	ok: true;
};

type BookingLinkResponse = WorkerSuccessResponse & {
	url: string;
	token: string;
	expires_at: string;
};

export async function trackCTA(input: CTAEventInput): Promise<void> {
	const baseUrl = requireWorkerEnv('ATTRIBUTION_WORKER_URL');
	const url = new URL('/track/cta', baseUrl);
	url.searchParams.set('type', input.type);
	url.searchParams.set('campaign_id', String(input.campaign_id));
	url.searchParams.set('campaign_page_id', String(input.campaign_page_id));

	if (input.lead_journey_id) {
		url.searchParams.set('lead_journey_id', input.lead_journey_id);
	}
	if (input.session_id) {
		url.searchParams.set('session_id', input.session_id);
	}
	if (input.anonymous_id) {
		url.searchParams.set('anonymous_id', input.anonymous_id);
	}
	if (input.cta_key) {
		url.searchParams.set('cta_key', input.cta_key);
	}
	if (input.cta_label) {
		url.searchParams.set('cta_label', input.cta_label);
	}
	if (input.cta_section) {
		url.searchParams.set('cta_section', input.cta_section);
	}
	if (input.cta_variant) {
		url.searchParams.set('cta_variant', input.cta_variant);
	}

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			Authorization: buildWorkerAuthHeader()
		}
	});

	await parseWorkerResponse<WorkerSuccessResponse>(response);
}

const BOOKING_LINK_NOT_FOUND_ERROR = 'Lead journey not found';
const BOOKING_LINK_MAX_ATTEMPTS = 3;
const BOOKING_LINK_RETRY_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createBookingLink(input: {
	lead_journey_id: string;
	campaign_id?: number;
}): Promise<BookingLinkResponse> {
	const baseUrl = requireWorkerEnv('ATTRIBUTION_WORKER_URL');
	const url = new URL('/booking/link', baseUrl);

	// The lead journey is written via the app's direct Postgres connection, while the
	// worker reads it via the Supabase REST API. A freshly-inserted journey may not yet
	// be visible to the worker's read path, so retry only on the "not found" race.
	let lastError: unknown;
	for (let attempt = 1; attempt <= BOOKING_LINK_MAX_ATTEMPTS; attempt += 1) {
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: buildWorkerAuthHeader(),
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(input)
			});

			return await parseWorkerResponse<BookingLinkResponse>(response);
		} catch (error) {
			lastError = error;
			const isNotFoundRace =
				error instanceof Error && error.message === BOOKING_LINK_NOT_FOUND_ERROR;

			if (!isNotFoundRace || attempt === BOOKING_LINK_MAX_ATTEMPTS) {
				throw error;
			}

			await delay(BOOKING_LINK_RETRY_DELAY_MS * attempt);
		}
	}

	throw lastError instanceof Error ? lastError : new Error('Failed to create booking link');
}
