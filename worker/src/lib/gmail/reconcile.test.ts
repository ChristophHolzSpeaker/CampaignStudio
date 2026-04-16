import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../../test/helpers';

vi.mock('./history-sync', () => ({
	listMailboxCursors: vi.fn(),
	syncMailboxHistory: vi.fn()
}));

import { listMailboxCursors, syncMailboxHistory } from './history-sync';
import { reconcileMailboxHealth } from './reconcile';

const mockedListMailboxCursors = vi.mocked(listMailboxCursors);
const mockedSyncMailboxHistory = vi.mocked(syncMailboxHistory);

function cursor(overrides?: Record<string, string | null>): {
	id: string;
	gmail_user: string;
	last_processed_history_id: string;
	watch_expiration: string;
	last_push_received_at: string | null;
	last_sync_at: string | null;
	sync_status: string;
} {
	const now = Date.now();
	return {
		id: 'cursor_1',
		gmail_user: 'speaker@christophholz.com',
		last_processed_history_id: '100',
		watch_expiration: new Date(now + 1000 * 60 * 60).toISOString(),
		last_push_received_at: new Date(now - 1000 * 60).toISOString(),
		last_sync_at: new Date(now - 1000 * 60).toISOString(),
		sync_status: 'active',
		...overrides
	};
}

describe('reconcileMailboxHealth', () => {
	beforeEach(() => {
		mockedListMailboxCursors.mockReset();
		mockedSyncMailboxHistory.mockReset();
	});

	it('marks healthy mailbox with recent push and sync', async () => {
		mockedListMailboxCursors.mockResolvedValue([cursor()]);

		const result = await reconcileMailboxHealth(makeTestEnv());
		expect(result).toHaveLength(1);
		expect(result[0]?.status).toBe('healthy');
		expect(mockedSyncMailboxHistory).not.toHaveBeenCalled();
	});

	it('attempts sync when push is stale', async () => {
		mockedListMailboxCursors.mockResolvedValue([
			cursor({ last_push_received_at: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString() })
		]);
		mockedSyncMailboxHistory.mockResolvedValue({
			ok: true,
			status: 'active',
			processed_messages: 2,
			last_history_id: '120'
		});

		const result = await reconcileMailboxHealth(makeTestEnv());
		expect(result[0]?.status).toBe('sync_attempted');
		expect(result[0]?.reason).toBe('missing_push_detected');
		expect(mockedSyncMailboxHistory).toHaveBeenCalledTimes(1);
	});

	it('skips retry when sync_failed is still under cooldown', async () => {
		mockedListMailboxCursors.mockResolvedValue([
			cursor({
				sync_status: 'sync_failed',
				last_sync_at: new Date(Date.now() - 1000 * 60 * 2).toISOString()
			})
		]);

		const result = await reconcileMailboxHealth(makeTestEnv());
		expect(result[0]?.status).toBe('retry_scheduled');
		expect(mockedSyncMailboxHistory).not.toHaveBeenCalled();
	});

	it('retries sync_failed mailbox after cooldown and returns resync_required', async () => {
		mockedListMailboxCursors.mockResolvedValue([
			cursor({
				sync_status: 'sync_failed',
				last_sync_at: new Date(Date.now() - 1000 * 60 * 20).toISOString()
			})
		]);
		mockedSyncMailboxHistory.mockResolvedValue({
			ok: false,
			status: 'resync_required',
			processed_messages: 0,
			last_history_id: '100'
		});

		const result = await reconcileMailboxHealth(makeTestEnv());
		expect(result[0]?.status).toBe('resync_required');
		expect(mockedSyncMailboxHistory).toHaveBeenCalledTimes(1);
	});

	it('honors existing resync_required without retrying sync', async () => {
		mockedListMailboxCursors.mockResolvedValue([cursor({ sync_status: 'resync_required' })]);

		const result = await reconcileMailboxHealth(makeTestEnv());
		expect(result[0]?.status).toBe('resync_required');
		expect(result[0]?.reason).toBe('cursor_marked_resync_required');
		expect(mockedSyncMailboxHistory).not.toHaveBeenCalled();
	});

	it('returns sync_failed when reconciliation sync throws', async () => {
		mockedListMailboxCursors.mockResolvedValue([
			cursor({ last_sync_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() })
		]);
		mockedSyncMailboxHistory.mockRejectedValue(new Error('network fail'));

		const result = await reconcileMailboxHealth(makeTestEnv());
		expect(result[0]?.status).toBe('sync_failed');
		expect(result[0]?.reason).toBe('reconcile_sync_unhandled_error');
	});
});
