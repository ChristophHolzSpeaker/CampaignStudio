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

import worker from './index';
import { renewGmailWatches } from './lib/gmail/watch';
import { reconcileMailboxHealth } from './lib/gmail/reconcile';
import { handleGmailPush } from './routes/gmail-push';
import { makeTestEnv, makeTestExecutionContext } from './test/helpers';

const mockedRenewGmailWatches = vi.mocked(renewGmailWatches);
const mockedReconcileMailboxHealth = vi.mocked(reconcileMailboxHealth);
const mockedHandleGmailPush = vi.mocked(handleGmailPush);

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
});
