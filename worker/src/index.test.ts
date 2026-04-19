import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerScheduledEvent } from './lib/env';

vi.mock('./lib/gmail/watch', () => ({
	renewGmailWatches: vi.fn()
}));

vi.mock('./lib/gmail/reconcile', () => ({
	reconcileMailboxHealth: vi.fn()
}));

vi.mock('./routes/gmail-push', () => ({
	handleGmailPush: vi.fn()
}));

vi.mock('./routes/gmail-watch-activate', () => ({
	handleGmailWatchActivate: vi.fn()
}));

vi.mock('./routes/booking-calendar-event', () => ({
	handleBookingCalendarEvent: vi.fn()
}));

vi.mock('./routes/booking-calendar-event-update', () => ({
	handleBookingCalendarEventUpdate: vi.fn()
}));

vi.mock('./routes/telegram-notification', () => ({
	handleTelegramNotification: vi.fn()
}));

vi.mock('./routes/woody-email-notification', () => ({
	handleWoodyEmailNotification: vi.fn()
}));

import worker from './index';
import { renewGmailWatches } from './lib/gmail/watch';
import { reconcileMailboxHealth } from './lib/gmail/reconcile';
import { handleGmailPush } from './routes/gmail-push';
import { handleGmailWatchActivate } from './routes/gmail-watch-activate';
import { handleBookingCalendarEvent } from './routes/booking-calendar-event';
import { handleBookingCalendarEventUpdate } from './routes/booking-calendar-event-update';
import { handleTelegramNotification } from './routes/telegram-notification';
import { handleWoodyEmailNotification } from './routes/woody-email-notification';
import { makeTestEnv, makeTestExecutionContext } from './test/helpers';

const mockedRenewGmailWatches = vi.mocked(renewGmailWatches);
const mockedReconcileMailboxHealth = vi.mocked(reconcileMailboxHealth);
const mockedHandleGmailPush = vi.mocked(handleGmailPush);
const mockedHandleGmailWatchActivate = vi.mocked(handleGmailWatchActivate);
const mockedHandleBookingCalendarEvent = vi.mocked(handleBookingCalendarEvent);
const mockedHandleBookingCalendarEventUpdate = vi.mocked(handleBookingCalendarEventUpdate);
const mockedHandleTelegramNotification = vi.mocked(handleTelegramNotification);
const mockedHandleWoodyEmailNotification = vi.mocked(handleWoodyEmailNotification);

describe('worker scheduled handler', () => {
	it('runs watch renewal and mailbox reconciliation in waitUntil', async () => {
		mockedRenewGmailWatches.mockResolvedValue([]);
		mockedReconcileMailboxHealth.mockResolvedValue([]);

		const { ctx, waitUntilMock } = makeTestExecutionContext();
		const event: WorkerScheduledEvent = {
			cron: '*/15 * * * *',
			scheduledTime: Date.now()
		};

		await worker.scheduled(event, makeTestEnv(), ctx);
		expect(waitUntilMock).toHaveBeenCalledTimes(1);

		const task = waitUntilMock.mock.calls[0]?.[0];
		await task;

		expect(mockedRenewGmailWatches).toHaveBeenCalledTimes(1);
		expect(mockedReconcileMailboxHealth).toHaveBeenCalledTimes(1);
	});
});

describe('worker fetch handler', () => {
	beforeEach(() => {
		mockedHandleGmailPush.mockReset();
		mockedHandleGmailWatchActivate.mockReset();
		mockedHandleBookingCalendarEvent.mockReset();
		mockedHandleBookingCalendarEventUpdate.mockReset();
		mockedHandleTelegramNotification.mockReset();
		mockedHandleWoodyEmailNotification.mockReset();
	});

	it('returns method not allowed for non-POST /gmail/push', async () => {
		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/gmail/push', { method: 'GET' });

		const response = await worker.fetch(request, makeTestEnv(), ctx);
		const json = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(405);
		expect(json.error).toBe('Method not allowed');
		expect(mockedHandleGmailPush).not.toHaveBeenCalled();
	});

	it('dispatches POST /gmail/push to route handler', async () => {
		mockedHandleGmailPush.mockResolvedValueOnce(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/gmail/push', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: { data: 'e30=', messageId: 'm1' }, subscription: 's1' })
		});

		const response = await worker.fetch(request, makeTestEnv(), ctx);

		expect(response.status).toBe(200);
		expect(mockedHandleGmailPush).toHaveBeenCalledTimes(1);
	});

	it('returns unauthorized for /gmail/watch/activate without auth', async () => {
		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/gmail/watch/activate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gmail_user: 'speaker@christophholz.com' })
		});

		const response = await worker.fetch(request, makeTestEnv(), ctx);
		expect(response.status).toBe(401);
		expect(mockedHandleGmailWatchActivate).not.toHaveBeenCalled();
	});

	it('dispatches authorized /gmail/watch/activate to route handler', async () => {
		mockedHandleGmailWatchActivate.mockResolvedValueOnce(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/gmail/watch/activate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: 'Bearer test'
			},
			body: JSON.stringify({ gmail_user: 'speaker@christophholz.com' })
		});

		const response = await worker.fetch(request, makeTestEnv(), ctx);
		expect(response.status).toBe(200);
		expect(mockedHandleGmailWatchActivate).toHaveBeenCalledTimes(1);
	});

	it('returns unauthorized for /booking/calendar-event without auth', async () => {
		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/booking/calendar-event', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});

		const response = await worker.fetch(request, makeTestEnv(), ctx);
		expect(response.status).toBe(401);
		expect(mockedHandleBookingCalendarEvent).not.toHaveBeenCalled();
	});

	it('dispatches authorized /booking/calendar-event to route handler', async () => {
		mockedHandleBookingCalendarEvent.mockResolvedValueOnce(
			new Response(JSON.stringify({ ok: true, event_id: 'evt_123' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/booking/calendar-event', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: 'Bearer test'
			},
			body: JSON.stringify({
				booking_id: '3fdb8e65-2ed6-4f56-a6d7-d749ccdc4690',
				booking_type: 'lead',
				attendee_email: 'lead@example.com',
				meeting_scope: 'Discuss campaign goals',
				starts_at_iso: '2026-06-01T10:00:00.000Z',
				ends_at_iso: '2026-06-01T10:30:00.000Z',
				reschedule_url: 'https://book.example.com/book/r/token',
				is_repeat_interaction: false
			})
		});

		const response = await worker.fetch(request, makeTestEnv(), ctx);
		expect(response.status).toBe(200);
		expect(mockedHandleBookingCalendarEvent).toHaveBeenCalledTimes(1);
	});

	it('returns unauthorized for /booking/calendar-event/update without auth', async () => {
		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/booking/calendar-event/update', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});

		const response = await worker.fetch(request, makeTestEnv(), ctx);
		expect(response.status).toBe(401);
		expect(mockedHandleBookingCalendarEventUpdate).not.toHaveBeenCalled();
	});

	it('dispatches authorized /booking/calendar-event/update to route handler', async () => {
		mockedHandleBookingCalendarEventUpdate.mockResolvedValueOnce(
			new Response(JSON.stringify({ ok: true, event_id: 'evt_123' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/booking/calendar-event/update', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: 'Bearer test'
			},
			body: JSON.stringify({
				booking_id: '3fdb8e65-2ed6-4f56-a6d7-d749ccdc4690',
				event_id: 'evt_123',
				booking_type: 'lead',
				attendee_email: 'lead@example.com',
				meeting_scope: 'Discuss campaign goals',
				starts_at_iso: '2026-06-02T10:00:00.000Z',
				ends_at_iso: '2026-06-02T10:30:00.000Z',
				reschedule_url: 'https://book.example.com/book/r/token',
				is_repeat_interaction: false
			})
		});

		const response = await worker.fetch(request, makeTestEnv(), ctx);
		expect(response.status).toBe(200);
		expect(mockedHandleBookingCalendarEventUpdate).toHaveBeenCalledTimes(1);
	});

	it('returns unauthorized for /notifications/telegram without auth', async () => {
		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/notifications/telegram', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});

		const response = await worker.fetch(request, makeTestEnv(), ctx);
		expect(response.status).toBe(401);
		expect(mockedHandleTelegramNotification).not.toHaveBeenCalled();
	});

	it('dispatches authorized /notifications/telegram to route handler', async () => {
		mockedHandleTelegramNotification.mockResolvedValueOnce(
			new Response(JSON.stringify({ ok: true, message_id: 1001 }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/notifications/telegram', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: 'Bearer test'
			},
			body: JSON.stringify({
				type: 'booking_confirmed',
				booking_id: '3fdb8e65-2ed6-4f56-a6d7-d749ccdc4690',
				booking_type: 'lead',
				booking_time: {
					starts_at_iso: '2026-06-10T10:00:00.000Z',
					ends_at_iso: '2026-06-10T10:30:00.000Z'
				}
			})
		});

		const response = await worker.fetch(request, makeTestEnv(), ctx);
		expect(response.status).toBe(200);
		expect(mockedHandleTelegramNotification).toHaveBeenCalledTimes(1);
	});

	it('returns unauthorized for /notifications/woody-email without auth', async () => {
		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/notifications/woody-email', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});

		const response = await worker.fetch(request, makeTestEnv(), ctx);
		expect(response.status).toBe(401);
		expect(mockedHandleWoodyEmailNotification).not.toHaveBeenCalled();
	});

	it('dispatches authorized /notifications/woody-email to route handler', async () => {
		mockedHandleWoodyEmailNotification.mockResolvedValueOnce(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/notifications/woody-email', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: 'Bearer test'
			},
			body: JSON.stringify({
				intent: 'booking_link_invite',
				recipient_email: 'lead@example.com',
				booking_type: 'lead',
				booking_link_url: 'https://book.example.com/book/l/token',
				email_content: {
					subject: 'Hello',
					body_text: 'Body'
				}
			})
		});

		const response = await worker.fetch(request, makeTestEnv(), ctx);
		expect(response.status).toBe(200);
		expect(mockedHandleWoodyEmailNotification).toHaveBeenCalledTimes(1);
	});
});
