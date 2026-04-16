import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../../test/helpers';

vi.mock('../db', () => ({
	updateMany: vi.fn()
}));

vi.mock('./client', () => ({
	gmailWatch: vi.fn()
}));

vi.mock('./history-sync', () => ({
	listMailboxCursors: vi.fn()
}));

import { updateMany } from '../db';
import { gmailWatch } from './client';
import { listMailboxCursors } from './history-sync';
import { renewGmailWatches } from './watch';

const mockedUpdateMany = vi.mocked(updateMany);
const mockedGmailWatch = vi.mocked(gmailWatch);
const mockedListMailboxCursors = vi.mocked(listMailboxCursors);

describe('renewGmailWatches', () => {
	beforeEach(() => {
		mockedUpdateMany.mockReset();
		mockedGmailWatch.mockReset();
		mockedListMailboxCursors.mockReset();
	});

	it('renews only due mailboxes and marks active on success', async () => {
		const now = Date.now();
		mockedListMailboxCursors.mockResolvedValue([
			{
				id: 'c1',
				gmail_user: 'due@christophholz.com',
				last_processed_history_id: '100',
				watch_expiration: new Date(now + 10 * 60 * 1000).toISOString(),
				last_push_received_at: null,
				last_sync_at: null,
				sync_status: 'active'
			},
			{
				id: 'c2',
				gmail_user: 'future@christophholz.com',
				last_processed_history_id: '200',
				watch_expiration: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
				last_push_received_at: null,
				last_sync_at: null,
				sync_status: 'active'
			}
		]);
		mockedGmailWatch.mockResolvedValue({ expiration: String(now + 48 * 60 * 60 * 1000) });

		const result = await renewGmailWatches(
			makeTestEnv({
				GMAIL_PUBSUB_TOPIC_NAME: 'projects/foo/topics/gmail-push',
				GMAIL_WATCH_RENEWAL_BUFFER_SECONDS: String(12 * 60 * 60),
				GMAIL_WATCH_LABEL_IDS: 'INBOX,IMPORTANT',
				GMAIL_WATCH_LABEL_FILTER_ACTION: 'include'
			})
		);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ gmail_user: 'due@christophholz.com', ok: true });
		expect(mockedGmailWatch).toHaveBeenCalledTimes(1);
		expect(mockedGmailWatch.mock.calls[0]?.[1]).toMatchObject({
			gmailUser: 'due@christophholz.com',
			topicName: 'projects/foo/topics/gmail-push',
			labelIds: ['INBOX', 'IMPORTANT'],
			labelFilterAction: 'include'
		});
		expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
	});

	it('marks renewal_failed when watch renewal errors', async () => {
		mockedListMailboxCursors.mockResolvedValue([
			{
				id: 'c1',
				gmail_user: 'due@christophholz.com',
				last_processed_history_id: '100',
				watch_expiration: 'invalid-date',
				last_push_received_at: null,
				last_sync_at: null,
				sync_status: 'active'
			}
		]);
		mockedGmailWatch.mockRejectedValue(new Error('watch failure'));

		const result = await renewGmailWatches(
			makeTestEnv({ GMAIL_PUBSUB_TOPIC_NAME: 'projects/foo/topics/gmail-push' })
		);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			gmail_user: 'due@christophholz.com',
			ok: false,
			status: 'renewal_failed'
		});
		expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
	});
});
