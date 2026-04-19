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
import { sendWoodyEmailNotificationViaWorker } from './woody-email-worker-client';

const mockedRequireWorkerEnv = vi.mocked(requireWorkerEnv);
const mockedBuildWorkerAuthHeader = vi.mocked(buildWorkerAuthHeader);
const mockedParseWorkerResponse = vi.mocked(parseWorkerResponse);

describe('sendWoodyEmailNotificationViaWorker', () => {
	beforeEach(() => {
		mockedRequireWorkerEnv.mockReset();
		mockedBuildWorkerAuthHeader.mockReset();
		mockedParseWorkerResponse.mockReset();
		vi.restoreAllMocks();
	});

	it('posts booking_confirmed payload with expected auth and endpoint', async () => {
		mockedRequireWorkerEnv.mockReturnValue('https://worker.example.com');
		mockedBuildWorkerAuthHeader.mockReturnValue('Bearer internal-token');
		mockedParseWorkerResponse.mockResolvedValueOnce({
			ok: true,
			provider_message_id: 'msg-1',
			provider_thread_id: 'thread-1'
		});

		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ ok: true })));

		await sendWoodyEmailNotificationViaWorker({
			intent: 'booking_confirmed',
			recipient_email: 'lead@example.com',
			booking_id: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
			booking_type: 'lead',
			confirmed_starts_at_iso: '2026-06-10T10:00:00.000Z',
			confirmed_ends_at_iso: '2026-06-10T10:30:00.000Z',
			calendar_event_url: 'https://calendar.google.com/event?eid=123',
			email_content: {
				subject: 'Your booking is confirmed',
				body_text: 'Body'
			}
		});

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0]?.[0].toString()).toBe(
			'https://worker.example.com/notifications/woody-email'
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
