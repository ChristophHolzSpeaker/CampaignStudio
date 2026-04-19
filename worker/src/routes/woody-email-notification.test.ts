import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/gmail/send', () => ({
	sendOutboundEmail: vi.fn()
}));

import { sendOutboundEmail } from '../lib/gmail/send';
import { makeTestEnv } from '../test/helpers';
import { handleWoodyEmailNotification } from './woody-email-notification';

const mockedSendOutboundEmail = vi.mocked(sendOutboundEmail);

describe('handleWoodyEmailNotification', () => {
	beforeEach(() => {
		mockedSendOutboundEmail.mockReset();
	});

	it('returns validation error for invalid payload', async () => {
		const response = await handleWoodyEmailNotification(
			new Request('https://worker.test/notifications/woody-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ intent: 'booking_confirmed' })
			}),
			makeTestEnv()
		);

		expect(response.status).toBe(400);
		expect(mockedSendOutboundEmail).not.toHaveBeenCalled();
	});

	it('routes booking_link_invite payload into gmail send service', async () => {
		mockedSendOutboundEmail.mockResolvedValueOnce({
			lead_message_id: 'lead-message-1',
			provider_message_id: 'gmail-message-1',
			provider_thread_id: 'thread-1'
		});

		const response = await handleWoodyEmailNotification(
			new Request('https://worker.test/notifications/woody-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					intent: 'booking_link_invite',
					recipient_email: 'lead@example.com',
					recipient_name: 'Lead User',
					booking_type: 'lead',
					booking_link_url: 'https://book.example.com/book/l/token',
					campaign_context: {
						lead_journey_id: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
						campaign_id: 7,
						campaign_page_id: 11
					},
					summary_context: {
						meeting_scope: 'Discuss goals'
					},
					email_content: {
						subject: 'Subject',
						body_text: 'Body'
					}
				})
			}),
			makeTestEnv({ GOOGLE_IMPERSONATED_USER: 'speaker@christophholz.com' })
		);

		expect(response.status).toBe(200);
		expect(mockedSendOutboundEmail).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				leadJourneyId: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
				to: ['lead@example.com'],
				subject: 'Subject'
			})
		);

		const payload = (await response.json()) as {
			ok: boolean;
			provider_message_id: string;
		};
		expect(payload.ok).toBe(true);
		expect(payload.provider_message_id).toBe('gmail-message-1');
	});
});
