import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/calendar/client', () => ({
	createCalendarEvent: vi.fn()
}));

import { createCalendarEvent } from '../lib/calendar/client';
import { handleBookingCalendarEvent } from './booking-calendar-event';
import { makeTestEnv } from '../test/helpers';

const mockedCreateCalendarEvent = vi.mocked(createCalendarEvent);

describe('handleBookingCalendarEvent', () => {
	beforeEach(() => {
		mockedCreateCalendarEvent.mockReset();
	});

	it('returns validation error when payload is invalid', async () => {
		const response = await handleBookingCalendarEvent(
			new Request('https://worker.test/booking/calendar-event', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ booking_type: 'lead' })
			}),
			makeTestEnv()
		);

		expect(response.status).toBe(400);
		expect(mockedCreateCalendarEvent).not.toHaveBeenCalled();
	});

	it('creates a calendar event with expected context', async () => {
		mockedCreateCalendarEvent.mockResolvedValueOnce({
			id: 'evt_123',
			htmlLink: 'https://calendar.google.com/event?eid=123'
		});

		const response = await handleBookingCalendarEvent(
			new Request('https://worker.test/booking/calendar-event', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					booking_id: '3fdb8e65-2ed6-4f56-a6d7-d749ccdc4690',
					booking_type: 'lead',
					attendee_email: 'lead@example.com',
					attendee_name: 'Lead User',
					company: 'ACME',
					meeting_scope: 'Discuss growth campaign',
					starts_at_iso: '2026-06-01T10:00:00.000Z',
					ends_at_iso: '2026-06-01T10:30:00.000Z',
					reschedule_url: 'https://book.example.com/book/r/resched123',
					is_repeat_interaction: true,
					lead_context: {
						lead_journey_id: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
						campaign_id: 44,
						booking_link_id: '0dbb6f24-81ff-4ad5-8f56-4afcc7a7816e'
					}
				})
			}),
			makeTestEnv({ GOOGLE_IMPERSONATED_USER: 'speaker@christophholz.com' })
		);

		expect(response.status).toBe(200);
		expect(mockedCreateCalendarEvent).toHaveBeenCalledTimes(1);
		expect(mockedCreateCalendarEvent).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({
				calendarId: 'speaker@christophholz.com',
				summary: 'Lead call - Lead User',
				startsAtIso: '2026-06-01T10:00:00.000Z',
				endsAtIso: '2026-06-01T10:30:00.000Z'
			})
		);

		const payload = (await response.json()) as { ok: boolean; event_id: string };
		expect(payload.ok).toBe(true);
		expect(payload.event_id).toBe('evt_123');
	});
});
