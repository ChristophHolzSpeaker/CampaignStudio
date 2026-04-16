import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../../test/helpers';

vi.mock('../db', () => ({
	insertOne: vi.fn(),
	selectMany: vi.fn(),
	selectOne: vi.fn(),
	updateMany: vi.fn()
}));

vi.mock('./client', () => ({
	gmailGetMessage: vi.fn(),
	gmailListHistory: vi.fn(),
	isHistoryCursorStale: vi.fn()
}));

vi.mock('./messages', () => ({
	normalizeGmailMessage: vi.fn()
}));

vi.mock('./process-inbound-message', () => ({
	processInboundGmailMessage: vi.fn()
}));

import { insertOne, selectMany, selectOne, updateMany } from '../db';
import { gmailGetMessage, gmailListHistory, isHistoryCursorStale } from './client';
import { normalizeGmailMessage } from './messages';
import { processInboundGmailMessage } from './process-inbound-message';
import { listMailboxCursors, syncMailboxHistory, touchMailboxPush } from './history-sync';

const mockedInsertOne = vi.mocked(insertOne);
const mockedSelectMany = vi.mocked(selectMany);
const mockedSelectOne = vi.mocked(selectOne);
const mockedUpdateMany = vi.mocked(updateMany);
const mockedGmailGetMessage = vi.mocked(gmailGetMessage);
const mockedGmailListHistory = vi.mocked(gmailListHistory);
const mockedIsHistoryCursorStale = vi.mocked(isHistoryCursorStale);
const mockedNormalizeGmailMessage = vi.mocked(normalizeGmailMessage);
const mockedProcessInboundGmailMessage = vi.mocked(processInboundGmailMessage);

const cursorRow = {
	id: 'cursor_1',
	gmail_user: 'speaker@christophholz.com',
	last_processed_history_id: '100',
	watch_expiration: '2026-04-16T00:00:00.000Z',
	last_push_received_at: null,
	last_sync_at: null,
	sync_status: 'active'
};

describe('history sync', () => {
	beforeEach(() => {
		mockedInsertOne.mockReset();
		mockedSelectMany.mockReset();
		mockedSelectOne.mockReset();
		mockedUpdateMany.mockReset();
		mockedGmailGetMessage.mockReset();
		mockedGmailListHistory.mockReset();
		mockedIsHistoryCursorStale.mockReset();
		mockedNormalizeGmailMessage.mockReset();
		mockedProcessInboundGmailMessage.mockReset();
		mockedIsHistoryCursorStale.mockReturnValue(false);
	});

	it('throws when mailbox cursor is missing', async () => {
		mockedSelectOne.mockResolvedValue(null);
		await expect(
			syncMailboxHistory(makeTestEnv(), { gmailUser: 'speaker@christophholz.com' })
		).rejects.toThrow('Mailbox cursor not found');
	});

	it('syncs inbound history messages and updates cursor', async () => {
		mockedSelectOne.mockResolvedValue(cursorRow);
		mockedGmailListHistory.mockResolvedValue({
			historyId: '110',
			history: [
				{ id: '105', messagesAdded: [{ message: { id: 'm1' } }] },
				{ id: '109', messagesAdded: [{ message: { id: 'm2' } }] }
			],
			nextPageToken: undefined
		});
		mockedGmailGetMessage
			.mockResolvedValueOnce({ id: 'm1', threadId: 't1' } as never)
			.mockResolvedValueOnce({ id: 'm2', threadId: 't2' } as never);
		mockedNormalizeGmailMessage
			.mockReturnValueOnce({ direction: 'inbound' } as never)
			.mockReturnValueOnce({ direction: 'inbound' } as never);
		mockedProcessInboundGmailMessage
			.mockResolvedValueOnce({
				status: 'processed',
				provider_message_id: 'm1',
				provider_thread_id: 't1'
			} as never)
			.mockResolvedValueOnce({
				status: 'duplicate_ignored',
				provider_message_id: 'm2',
				provider_thread_id: 't2'
			} as never);

		const result = await syncMailboxHistory(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			hintedHistoryId: '120'
		});

		expect(result.ok).toBe(true);
		expect(result.status).toBe('active');
		expect(result.processed_messages).toBe(1);
		expect(result.last_history_id).toBe('120');
		expect(mockedUpdateMany).toHaveBeenCalled();
	});

	it('marks resync_required when history cursor is stale', async () => {
		mockedSelectOne.mockResolvedValue(cursorRow);
		mockedGmailListHistory.mockRejectedValue(new Error('stale history'));
		mockedIsHistoryCursorStale.mockReturnValue(true);

		const result = await syncMailboxHistory(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com'
		});

		expect(result.status).toBe('resync_required');
		expect(result.ok).toBe(false);
	});

	it('marks sync_failed on non-stale sync failures', async () => {
		mockedSelectOne.mockResolvedValue(cursorRow);
		mockedGmailListHistory.mockRejectedValue(new Error('network error'));
		mockedIsHistoryCursorStale.mockReturnValue(false);

		const result = await syncMailboxHistory(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com'
		});

		expect(result.status).toBe('sync_failed');
		expect(result.ok).toBe(false);
	});

	it('touchMailboxPush returns null when cursor missing and no history id', async () => {
		mockedSelectOne.mockResolvedValue(null);

		const touched = await touchMailboxPush(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			historyId: null
		});

		expect(touched).toBeNull();
		expect(mockedInsertOne).not.toHaveBeenCalled();
	});

	it('touchMailboxPush creates cursor when missing and history id provided', async () => {
		mockedSelectOne
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ ...cursorRow, last_processed_history_id: '300' });

		const touched = await touchMailboxPush(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			historyId: '300'
		});

		expect(mockedInsertOne).toHaveBeenCalledTimes(1);
		expect(touched?.last_processed_history_id).toBe('300');
	});

	it('touchMailboxPush updates push timestamp and returns max history id', async () => {
		mockedSelectOne.mockResolvedValue(cursorRow);

		const touched = await touchMailboxPush(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			historyId: '150'
		});

		expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
		expect(touched?.last_processed_history_id).toBe('150');
	});

	it('lists mailbox cursors', async () => {
		mockedSelectMany.mockResolvedValue([cursorRow]);

		const cursors = await listMailboxCursors(makeTestEnv());
		expect(cursors).toEqual([cursorRow]);
		expect(mockedSelectMany).toHaveBeenCalledTimes(1);
	});
});
