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
import { createBookingCalendarEventViaWorker } from './worker-calendar-client';

const mockedRequireWorkerEnv = vi.mocked(requireWorkerEnv);
const mockedBuildWorkerAuthHeader = vi.mocked(buildWorkerAuthHeader);
const mockedParseWorkerResponse = vi.mocked(parseWorkerResponse);

describe('createBookingCalendarEventViaWorker', () => {
	beforeEach(() => {
		mockedRequireWorkerEnv.mockReset();
		mockedBuildWorkerAuthHeader.mockReset();
		mockedParseWorkerResponse.mockReset();
		vi.restoreAllMocks();
	});

	it('invokes worker endpoint with expected payload shape', async () => {
		mockedRequireWorkerEnv.mockReturnValue('https://worker.example.com');
		mockedBuildWorkerAuthHeader.mockReturnValue('Bearer internal-token');
		mockedParseWorkerResponse.mockResolvedValueOnce({
			ok: true,
			event_id: 'evt_123'
		});

		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ ok: true, event_id: 'evt_123' })));

		await createBookingCalendarEventViaWorker({
			booking_id: 'booking-1',
			booking_type: 'lead',
			attendee_email: 'lead@example.com',
			attendee_name: 'Lead User',
			meeting_scope: 'Discuss launch',
			starts_at_iso: '2026-06-01T10:00:00.000Z',
			ends_at_iso: '2026-06-01T10:30:00.000Z',
			reschedule_url: 'https://book.example.com/book/r/token',
			company: 'ACME',
			is_repeat_interaction: false,
			lead_context: {
				lead_journey_id: 'journey-1',
				campaign_id: 9
			}
		});

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0]?.[0].toString()).toBe(
			'https://worker.example.com/booking/calendar-event'
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
