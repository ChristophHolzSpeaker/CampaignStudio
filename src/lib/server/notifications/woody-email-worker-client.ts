import type {
	WoodyEmailNotificationRequest,
	WoodyEmailNotificationResponse
} from '../../../../shared/woody-email-notifications';
import {
	buildWorkerAuthHeader,
	parseWorkerResponse,
	requireWorkerEnv
} from '$lib/server/worker/internal-client';

export async function sendWoodyEmailNotificationViaWorker(
	input: WoodyEmailNotificationRequest
): Promise<WoodyEmailNotificationResponse> {
	const baseUrl = requireWorkerEnv('ATTRIBUTION_WORKER_URL');
	const url = new URL('/notifications/woody-email', baseUrl);

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: buildWorkerAuthHeader(),
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(input)
	});

	return parseWorkerResponse<WoodyEmailNotificationResponse>(response);
}
