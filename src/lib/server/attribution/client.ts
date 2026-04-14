import { env } from '$env/dynamic/private';
import type { CTAEventInput } from '../../../../shared/attribution';

type WorkerSuccessResponse = {
	ok: true;
};

type BookingLinkResponse = WorkerSuccessResponse & {
	url: string;
	token: string;
	expires_at: string;
};

type WorkerErrorResponse = {
	ok: false;
	error: string;
};

function requirePrivateEnv(name: 'ATTRIBUTION_WORKER_URL' | 'ATTRIBUTION_INTERNAL_TOKEN'): string {
	const value = env[name];
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
}

function buildAuthHeader(): string {
	const token = requirePrivateEnv('ATTRIBUTION_INTERNAL_TOKEN');
	return `Bearer ${token}`;
}

async function parseWorkerResponse<T>(response: Response): Promise<T> {
	const payload = (await response.json()) as T | WorkerErrorResponse;
	if (!response.ok) {
		const errorMessage =
			typeof payload === 'object' && payload !== null && 'error' in payload
				? payload.error
				: `Worker request failed with status ${response.status}`;
		throw new Error(errorMessage);
	}
	return payload as T;
}

export async function trackCTA(input: CTAEventInput): Promise<void> {
	const baseUrl = requirePrivateEnv('ATTRIBUTION_WORKER_URL');
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
			Authorization: buildAuthHeader()
		}
	});

	await parseWorkerResponse<WorkerSuccessResponse>(response);
}

export async function createBookingLink(input: {
	lead_journey_id: string;
	campaign_id?: number;
}): Promise<BookingLinkResponse> {
	const baseUrl = requirePrivateEnv('ATTRIBUTION_WORKER_URL');
	const url = new URL('/booking/link', baseUrl);
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: buildAuthHeader(),
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(input)
	});

	return parseWorkerResponse<BookingLinkResponse>(response);
}
