import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/calendar/client', () => ({
	updateCalendarEvent: vi.fn()
}));

import { updateCalendarEvent } from '../lib/calendar/client';
import { handleBookingCalendarEventUpdate } from './booking-calendar-event-update';
import { makeTestEnv } from '../test/helpers';

const mockedUpdateCalendarEvent = vi.mocked(updateCalendarEvent);

describe('handleBookingCalendarEventUpdate', () => {
	beforeEach(() => {
		mockedUpdateCalendarEvent.mockReset();
	});

	it('returns validation error when payload is invalid', async () => {
		const response = await handleBookingCalendarEventUpdate(
			new Request('https://worker.test/booking/calendar-event/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ booking_type: 'lead' })
			}),
			makeTestEnv()
		);

		expect(response.status).toBe(400);
		expect(mockedUpdateCalendarEvent).not.toHaveBeenCalled();
	});

	it('updates an existing calendar event by event id', async () => {
		mockedUpdateCalendarEvent.mockResolvedValueOnce({
			id: 'evt_123',
			htmlLink: 'https://calendar.google.com/event?eid=123'
		});

		const response = await handleBookingCalendarEventUpdate(
			new Request('https://worker.test/booking/calendar-event/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					booking_id: '3fdb8e65-2ed6-4f56-a6d7-d749ccdc4690',
					event_id: 'evt_123',
					booking_type: 'lead',
					attendee_email: 'lead@example.com',
					attendee_name: 'Lead User',
					company: 'ACME',
					meeting_scope: 'Discuss growth campaign',
					starts_at_iso: '2026-06-02T10:00:00.000Z',
					ends_at_iso: '2026-06-02T10:30:00.000Z',
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
		expect(mockedUpdateCalendarEvent).toHaveBeenCalledTimes(1);
		expect(mockedUpdateCalendarEvent).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({
				calendarId: 'speaker@christophholz.com',
				eventId: 'evt_123',
				summary: 'Video briefing with Christoph + Lead User from ACME',
				description: expect.stringContaining('Request summary:\nDiscuss growth campaign'),
				startsAtIso: '2026-06-02T10:00:00.000Z',
				endsAtIso: '2026-06-02T10:30:00.000Z'
			})
		);
		expect(mockedUpdateCalendarEvent.mock.calls[0]?.[1].description).toContain(
			'https://zoom.christophholz.com'
		);
		expect(mockedUpdateCalendarEvent.mock.calls[0]?.[1].description).toContain(
			'Reschedule link: https://book.example.com/book/r/resched123'
		);
		expect(mockedUpdateCalendarEvent.mock.calls[0]?.[1].description).not.toContain('Booking ID:');

		const payload = (await response.json()) as { ok: boolean; event_id: string };
		expect(payload.ok).toBe(true);
		expect(payload.event_id).toBe('evt_123');
	});

	it('omits from-company in summary when company is missing', async () => {
		mockedUpdateCalendarEvent.mockResolvedValueOnce({
			id: 'evt_124',
			htmlLink: 'https://calendar.google.com/event?eid=124'
		});

		await handleBookingCalendarEventUpdate(
			new Request('https://worker.test/booking/calendar-event/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					booking_id: '3fdb8e65-2ed6-4f56-a6d7-d749ccdc4690',
					event_id: 'evt_124',
					booking_type: 'lead',
					attendee_email: 'lead@example.com',
					attendee_name: 'Lead User',
					company: null,
					meeting_scope: 'Discuss growth campaign',
					starts_at_iso: '2026-06-02T10:00:00.000Z',
					ends_at_iso: '2026-06-02T10:30:00.000Z',
					reschedule_url: 'https://book.example.com/book/r/resched123',
					is_repeat_interaction: false,
					lead_context: null
				})
			}),
			makeTestEnv({ GOOGLE_IMPERSONATED_USER: 'speaker@christophholz.com' })
		);

		expect(mockedUpdateCalendarEvent).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({ summary: 'Video briefing with Christoph + Lead User' })
		);
	});
});
