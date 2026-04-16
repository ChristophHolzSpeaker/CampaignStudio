import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeJsonBase64, makeTestEnv, makeTestExecutionContext } from '../test/helpers';

vi.mock('../lib/gmail/history-sync', () => ({
	touchMailboxPush: vi.fn(),
	syncMailboxHistory: vi.fn()
}));

import { syncMailboxHistory, touchMailboxPush } from '../lib/gmail/history-sync';
import { handleGmailPush } from './gmail-push';

const mockedTouchMailboxPush = vi.mocked(touchMailboxPush);
const mockedSyncMailboxHistory = vi.mocked(syncMailboxHistory);

function makeRequest(url: string, body: unknown): Request {
	return new Request(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('handleGmailPush', () => {
	beforeEach(() => {
		mockedTouchMailboxPush.mockReset();
		mockedSyncMailboxHistory.mockReset();
	});

	it('rejects unauthorized token when verification token is configured', async () => {
		const { ctx } = makeTestExecutionContext();
		const request = makeRequest('https://worker.test/gmail/push?token=wrong', {});

		const response = await handleGmailPush(
			request,
			makeTestEnv({ GMAIL_PUSH_VERIFICATION_TOKEN: 'expected' }),
			ctx
		);

		expect(response.status).toBe(401);
		expect(mockedTouchMailboxPush).not.toHaveBeenCalled();
	});

	it('returns 400 for invalid JSON payload', async () => {
		const { ctx } = makeTestExecutionContext();
		const request = new Request('https://worker.test/gmail/push', {
			method: 'POST',
			body: 'not-json',
			headers: { 'Content-Type': 'application/json' }
		});

		const response = await handleGmailPush(request, makeTestEnv(), ctx);
		expect(response.status).toBe(400);
	});

	it('returns 400 for invalid pubsub data encoding', async () => {
		const { ctx } = makeTestExecutionContext();
		const request = makeRequest('https://worker.test/gmail/push', {
			message: { data: '%%%%' }
		});

		const response = await handleGmailPush(request, makeTestEnv(), ctx);
		expect(response.status).toBe(400);
	});

	it('returns 400 when gmail user cannot be resolved', async () => {
		const { ctx } = makeTestExecutionContext();
		const request = makeRequest('https://worker.test/gmail/push', {
			message: {
				data: encodeJsonBase64({ historyId: '123' })
			}
		});

		const response = await handleGmailPush(request, makeTestEnv(), ctx);
		expect(response.status).toBe(400);
	});

	it('acknowledges with sync_triggered=false when cursor missing', async () => {
		mockedTouchMailboxPush.mockResolvedValue(null);

		const { ctx, waitUntilMock } = makeTestExecutionContext();
		const request = makeRequest('https://worker.test/gmail/push', {
			message: {
				messageId: 'm1',
				data: encodeJsonBase64({ emailAddress: 'speaker@christophholz.com', historyId: '123' })
			}
		});

		const response = await handleGmailPush(request, makeTestEnv(), ctx);
		const json = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(json.sync_triggered).toBe(false);
		expect(waitUntilMock).not.toHaveBeenCalled();
	});

	it('triggers async sync when cursor exists', async () => {
		mockedTouchMailboxPush.mockResolvedValue({
			id: 'cursor_1',
			gmail_user: 'speaker@christophholz.com',
			last_processed_history_id: '120',
			watch_expiration: '2026-04-16T00:00:00.000Z',
			last_push_received_at: null,
			last_sync_at: null,
			sync_status: 'active'
		});
		mockedSyncMailboxHistory.mockResolvedValue({
			ok: true,
			status: 'active',
			processed_messages: 2,
			last_history_id: '123'
		});

		const { ctx, waitUntilMock } = makeTestExecutionContext();
		const request = makeRequest('https://worker.test/gmail/push', {
			message: {
				data: encodeJsonBase64({ emailAddress: 'speaker@christophholz.com', historyId: '123' })
			}
		});

		const response = await handleGmailPush(request, makeTestEnv(), ctx);
		const json = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(json.sync_triggered).toBe(true);
		expect(mockedTouchMailboxPush).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({ gmailUser: 'speaker@christophholz.com', historyId: '123' })
		);
		expect(mockedSyncMailboxHistory).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({ gmailUser: 'speaker@christophholz.com', hintedHistoryId: '123' })
		);
		expect(waitUntilMock).toHaveBeenCalledTimes(1);
	});
});
