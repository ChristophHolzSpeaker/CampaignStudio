import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/gmail/send', () => ({
	sendOutboundEmail: vi.fn()
}));

import { sendOutboundEmail } from '../lib/gmail/send';
import { makeTestEnv } from '../test/helpers';
import { handleFormSubmissionNotification } from './form-submission-notification';

const mockedSendOutboundEmail = vi.mocked(sendOutboundEmail);

describe('handleFormSubmissionNotification', () => {
	beforeEach(() => {
		mockedSendOutboundEmail.mockReset();
	});

	it('returns validation error for invalid payload', async () => {
		const response = await handleFormSubmissionNotification(
			new Request('https://worker.test/notifications/form-submission', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subject: 'Missing required fields' })
			}),
			makeTestEnv()
		);

		expect(response.status).toBe(400);
		expect(mockedSendOutboundEmail).not.toHaveBeenCalled();
	});

	it('routes valid payload into gmail send service', async () => {
		mockedSendOutboundEmail.mockResolvedValueOnce({
			lead_message_id: null,
			provider_message_id: 'gmail-message-1',
			provider_thread_id: 'thread-1'
		});

		const response = await handleFormSubmissionNotification(
			new Request('https://worker.test/notifications/form-submission', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					to_email: 'speaker@christophholz.com',
					subject: 'Booking form submission',
					body_text: 'Body'
				})
			}),
			makeTestEnv({ GOOGLE_IMPERSONATED_USER: 'speaker@christophholz.com' })
		);

		expect(response.status).toBe(200);
		expect(mockedSendOutboundEmail).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				gmailUser: 'speaker@christophholz.com',
				to: ['speaker@christophholz.com'],
				subject: 'Booking form submission'
			})
		);

		const payload = (await response.json()) as { ok: boolean; provider_message_id: string };
		expect(payload.ok).toBe(true);
		expect(payload.provider_message_id).toBe('gmail-message-1');
	});

	it('returns 502 when send fails', async () => {
		mockedSendOutboundEmail.mockRejectedValueOnce(new Error('send failed'));

		const response = await handleFormSubmissionNotification(
			new Request('https://worker.test/notifications/form-submission', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					to_email: 'speaker@christophholz.com',
					subject: 'Booking form submission',
					body_text: 'Body'
				})
			}),
			makeTestEnv({ GOOGLE_IMPERSONATED_USER: 'speaker@christophholz.com' })
		);

		expect(response.status).toBe(502);
	});
});
