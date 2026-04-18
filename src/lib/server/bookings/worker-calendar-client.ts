import type {
	CreateBookingCalendarEventRequest,
	CreateBookingCalendarEventResponse
} from '../../../../shared/booking-calendar';
import {
	buildWorkerAuthHeader,
	parseWorkerResponse,
	requireWorkerEnv
} from '$lib/server/worker/internal-client';

export async function createBookingCalendarEventViaWorker(
	input: CreateBookingCalendarEventRequest
): Promise<CreateBookingCalendarEventResponse> {
	const baseUrl = requireWorkerEnv('ATTRIBUTION_WORKER_URL');
	const url = new URL('/booking/calendar-event', baseUrl);

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: buildWorkerAuthHeader(),
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(input)
	});

	return parseWorkerResponse<CreateBookingCalendarEventResponse>(response);
}
