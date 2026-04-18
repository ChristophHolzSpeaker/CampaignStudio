import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/worker/internal-client', () => ({
	requireWorkerEnv: vi.fn(),
	buildWorkerAuthHeader: vi.fn(),
	parseWorkerResponse: vi.fn()
}));

import {
	requireWorkerEnv,
	buildWorkerAuthHeader,
	parseWorkerResponse
} from '$lib/server/worker/internal-client';
import { sendTelegramNotificationViaWorker } from './telegram-worker-client';

const mockedRequireWorkerEnv = vi.mocked(requireWorkerEnv);
const mockedBuildWorkerAuthHeader = vi.mocked(buildWorkerAuthHeader);
const mockedParseWorkerResponse = vi.mocked(parseWorkerResponse);

describe('sendTelegramNotificationViaWorker', () => {
	beforeEach(() => {
		mockedRequireWorkerEnv.mockReset();
		mockedBuildWorkerAuthHeader.mockReset();
		mockedParseWorkerResponse.mockReset();
		vi.restoreAllMocks();
	});

	it('invokes worker endpoint with auth header and normalized payload', async () => {
		mockedRequireWorkerEnv.mockReturnValue('https://worker.example.com');
		mockedBuildWorkerAuthHeader.mockReturnValue('Bearer internal-token');
		mockedParseWorkerResponse.mockResolvedValueOnce({ ok: true, message_id: 123 });

		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ ok: true, message_id: 123 })));

		await sendTelegramNotificationViaWorker({
			type: 'booking_confirmed',
			booking_id: 'booking-1',
			booking_type: 'lead',
			attendee_name: 'Lead User',
			attendee_email: 'lead@example.com',
			meeting_scope: 'Discuss launch strategy',
			booking_time: {
				starts_at_iso: '2026-06-10T10:00:00.000Z',
				ends_at_iso: '2026-06-10T10:30:00.000Z'
			},
			campaign_context: {
				lead_journey_id: 'journey-1',
				campaign_id: 7,
				campaign_page_id: 11
			}
		});

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0]?.[0].toString()).toBe(
			'https://worker.example.com/notifications/telegram'
		);
		expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					Authorization: 'Bearer internal-token',
					'Content-Type': 'application/json'
				})
			})
		);
		expect(mockedParseWorkerResponse).toHaveBeenCalledTimes(1);
	});
});
