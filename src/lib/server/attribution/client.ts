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

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			Authorization: buildWorkerAuthHeader()
		}
	});

	await parseWorkerResponse<WorkerSuccessResponse>(response);
}

export async function createBookingLink(input: {
	lead_journey_id: string;
	campaign_id?: number;
}): Promise<BookingLinkResponse> {
	const baseUrl = requireWorkerEnv('ATTRIBUTION_WORKER_URL');
	const url = new URL('/booking/link', baseUrl);
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: buildWorkerAuthHeader(),
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(input)
	});

	return parseWorkerResponse<BookingLinkResponse>(response);
}
