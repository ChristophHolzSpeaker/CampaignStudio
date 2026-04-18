import type {
	TelegramNotificationRequest,
	TelegramNotificationResponse
} from '../../../../shared/telegram-notifications';
import {
	buildWorkerAuthHeader,
	parseWorkerResponse,
	requireWorkerEnv
} from '$lib/server/worker/internal-client';

export async function sendTelegramNotificationViaWorker(
	input: TelegramNotificationRequest
): Promise<TelegramNotificationResponse> {
	const baseUrl = requireWorkerEnv('ATTRIBUTION_WORKER_URL');
	const url = new URL('/notifications/telegram', baseUrl);

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: buildWorkerAuthHeader(),
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(input)
	});

	return parseWorkerResponse<TelegramNotificationResponse>(response);
}
