import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/notifications/form-submission-worker-client', () => ({
	sendFormSubmissionNotificationViaWorker: vi.fn()
}));

import { sendFormSubmissionNotificationViaWorker } from '$lib/server/notifications/form-submission-worker-client';
import { notifyBookingFormSubmission } from './booking-form-submission';

const mockedSendFormSubmissionNotificationViaWorker = vi.mocked(sendFormSubmissionNotificationViaWorker);

describe('notifyBookingFormSubmission', () => {
	beforeEach(() => {
		mockedSendFormSubmissionNotificationViaWorker.mockReset();
		mockedSendFormSubmissionNotificationViaWorker.mockResolvedValue({
			ok: true,
			provider_message_id: 'msg-1',
			provider_thread_id: 'thread-1'
		});
	});

	it('composes and sends expected payload to worker client', async () => {
		await notifyBookingFormSubmission({
			flow: 'book_g',
			email: 'lead@example.com',
			name: 'Lead User',
			phone: '+43123456789',
			company: 'ACME',
			scope: 'Discuss campaign launch',
			campaignId: 7,
			campaignPageId: 11,
			pageSlug: 'speaker-keynote',
			pagePath: '/book/g'
		});

		expect(mockedSendFormSubmissionNotificationViaWorker).toHaveBeenCalledTimes(1);
		expect(mockedSendFormSubmissionNotificationViaWorker).toHaveBeenCalledWith(
			expect.objectContaining({
				to_email: 'speaker@christophholz.com',
				subject: expect.stringContaining('book_g'),
				body_text: expect.stringContaining('Email: lead@example.com'),
				metadata: expect.objectContaining({
					flow: 'book_g',
					email: 'lead@example.com',
					campaign_id: 7,
					campaign_page_id: 11,
					page_slug: 'speaker-keynote',
					page_path: '/book/g'
				})
			})
		);
	});
});
