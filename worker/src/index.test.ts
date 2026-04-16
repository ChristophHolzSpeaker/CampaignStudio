import { describe, expect, it, vi } from 'vitest';
import type { WorkerScheduledEvent } from './lib/env';

vi.mock('./lib/gmail/watch', () => ({
	renewGmailWatches: vi.fn()
}));

vi.mock('./lib/gmail/reconcile', () => ({
	reconcileMailboxHealth: vi.fn()
}));

import worker from './index';
import { renewGmailWatches } from './lib/gmail/watch';
import { reconcileMailboxHealth } from './lib/gmail/reconcile';
import { makeTestEnv, makeTestExecutionContext } from './test/helpers';

const mockedRenewGmailWatches = vi.mocked(renewGmailWatches);
const mockedReconcileMailboxHealth = vi.mocked(reconcileMailboxHealth);

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
