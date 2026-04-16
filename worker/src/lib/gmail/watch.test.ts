import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../../test/helpers';

vi.mock('../db', () => ({
	updateMany: vi.fn(),
	upsertOne: vi.fn()
}));

vi.mock('./client', () => ({
	gmailWatch: vi.fn()
}));

vi.mock('./history-sync', () => ({
	listMailboxCursors: vi.fn()
}));

import { updateMany, upsertOne } from '../db';
import { gmailWatch } from './client';
import { listMailboxCursors } from './history-sync';
import { activateMailboxWatch, renewGmailWatches } from './watch';

const mockedUpdateMany = vi.mocked(updateMany);
const mockedUpsertOne = vi.mocked(upsertOne);
const mockedGmailWatch = vi.mocked(gmailWatch);
const mockedListMailboxCursors = vi.mocked(listMailboxCursors);

describe('renewGmailWatches', () => {
	beforeEach(() => {
		mockedUpdateMany.mockReset();
		mockedUpsertOne.mockReset();
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
				GOOGLE_WATCH_TOPIC: 'projects/foo/topics/gmail-push',
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
			labelFilterBehavior: 'INCLUDE'
		});
		expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
	});

	it('falls back to GMAIL_PUBSUB_TOPIC_NAME when GOOGLE_WATCH_TOPIC is not set', async () => {
		const now = Date.now();
		mockedListMailboxCursors.mockResolvedValue([
			{
				id: 'c1',
				gmail_user: 'due@christophholz.com',
				last_processed_history_id: '100',
				watch_expiration: new Date(now).toISOString(),
				last_push_received_at: null,
				last_sync_at: null,
				sync_status: 'active'
			}
		]);
		mockedGmailWatch.mockResolvedValue({ expiration: String(now + 60 * 60 * 1000) });

		await renewGmailWatches(
			makeTestEnv({
				GMAIL_PUBSUB_TOPIC_NAME: 'projects/legacy/topics/gmail-push'
			})
		);

		expect(mockedGmailWatch.mock.calls[0]?.[1]?.topicName).toBe(
			'projects/legacy/topics/gmail-push'
		);
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

	it('activates mailbox watch and stores historyId and expiration', async () => {
		const now = Date.now();
		mockedGmailWatch.mockResolvedValue({
			historyId: '321',
			expiration: String(now + 24 * 60 * 60 * 1000)
		});

		const result = await activateMailboxWatch(
			makeTestEnv({
				GOOGLE_WATCH_TOPIC: 'projects/new/topics/gmail-push',
				GMAIL_WATCH_LABEL_IDS: 'INBOX'
			}),
			{ gmailUser: 'speaker@christophholz.com' }
		);

		expect(result.ok).toBe(true);
		expect(result.status).toBe('active');
		expect(result.history_id).toBe('321');
		expect(mockedUpsertOne).toHaveBeenCalledTimes(1);
		expect(mockedUpsertOne.mock.calls[0]?.[1]).toBe('mailbox_cursors');
		expect(mockedUpsertOne.mock.calls[0]?.[2]).toMatchObject({
			gmail_user: 'speaker@christophholz.com',
			last_processed_history_id: '321',
			sync_status: 'active'
		});
		expect(mockedGmailWatch.mock.calls[0]?.[1]).toMatchObject({
			topicName: 'projects/new/topics/gmail-push',
			labelIds: ['INBOX']
		});
	});

	it('returns activation_failed when watch response has no historyId', async () => {
		mockedGmailWatch.mockResolvedValue({ expiration: String(Date.now() + 1000) });

		const result = await activateMailboxWatch(
			makeTestEnv({ GOOGLE_WATCH_TOPIC: 'projects/new/topics/gmail-push' }),
			{ gmailUser: 'speaker@christophholz.com' }
		);

		expect(result.ok).toBe(false);
		expect(result.status).toBe('activation_failed');
		expect(mockedUpsertOne).not.toHaveBeenCalled();
	});
});
