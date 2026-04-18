import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/telegram/service', () => ({
	sendTelegramNotification: vi.fn()
}));

import { sendTelegramNotification } from '../lib/telegram/service';
import { handleTelegramNotification } from './telegram-notification';
import { makeTestEnv } from '../test/helpers';

const mockedSendTelegramNotification = vi.mocked(sendTelegramNotification);

describe('handleTelegramNotification', () => {
	beforeEach(() => {
		mockedSendTelegramNotification.mockReset();
	});

	it('returns validation error when payload is invalid', async () => {
		const response = await handleTelegramNotification(
			new Request('https://worker.test/notifications/telegram', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'booking_confirmed' })
			}),
			makeTestEnv()
		);

		expect(response.status).toBe(400);
		expect(mockedSendTelegramNotification).not.toHaveBeenCalled();
	});

	it('routes valid payload to telegram service', async () => {
		mockedSendTelegramNotification.mockResolvedValueOnce({ message_id: 123 });

		const response = await handleTelegramNotification(
			new Request('https://worker.test/notifications/telegram', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'booking_confirmed',
					booking_id: '3fdb8e65-2ed6-4f56-a6d7-d749ccdc4690',
					booking_type: 'lead',
					attendee_email: 'lead@example.com',
					booking_time: {
						starts_at_iso: '2026-06-10T10:00:00.000Z',
						ends_at_iso: '2026-06-10T10:30:00.000Z'
					}
				})
			}),
			makeTestEnv()
		);

		expect(response.status).toBe(200);
		expect(mockedSendTelegramNotification).toHaveBeenCalledTimes(1);
		const payload = (await response.json()) as { ok: boolean; message_id?: number };
		expect(payload.ok).toBe(true);
		expect(payload.message_id).toBe(123);
	});

	it('returns useful failure payload when telegram send fails', async () => {
		mockedSendTelegramNotification.mockRejectedValueOnce(
			new Error('Telegram send failed (status=401)')
		);

		const response = await handleTelegramNotification(
			new Request('https://worker.test/notifications/telegram', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'new_lead',
					attendee_email: 'lead@example.com'
				})
			}),
			makeTestEnv()
		);

		expect(response.status).toBe(502);
		const payload = (await response.json()) as { ok: boolean; error: string };
		expect(payload.ok).toBe(false);
		expect(payload.error).toContain('Telegram send failed');
	});
});
