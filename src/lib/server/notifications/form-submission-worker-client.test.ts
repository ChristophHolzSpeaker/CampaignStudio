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
import { sendFormSubmissionNotificationViaWorker } from './form-submission-worker-client';

const mockedRequireWorkerEnv = vi.mocked(requireWorkerEnv);
const mockedBuildWorkerAuthHeader = vi.mocked(buildWorkerAuthHeader);
const mockedParseWorkerResponse = vi.mocked(parseWorkerResponse);

describe('sendFormSubmissionNotificationViaWorker', () => {
	beforeEach(() => {
		mockedRequireWorkerEnv.mockReset();
		mockedBuildWorkerAuthHeader.mockReset();
		mockedParseWorkerResponse.mockReset();
		vi.restoreAllMocks();
	});

	it('posts form submission payload with expected auth and endpoint', async () => {
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

		await sendFormSubmissionNotificationViaWorker({
			to_email: 'speaker@christophholz.com',
			subject: 'Booking form submission',
			body_text: 'Body'
		});

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0]?.[0].toString()).toBe(
			'https://worker.example.com/notifications/form-submission'
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
