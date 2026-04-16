import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../test/helpers';

vi.mock('../lib/gmail/watch', () => ({
	activateMailboxWatch: vi.fn()
}));

import { activateMailboxWatch } from '../lib/gmail/watch';
import { handleGmailWatchActivate } from './gmail-watch-activate';

const mockedActivateMailboxWatch = vi.mocked(activateMailboxWatch);

function makeRequest(body: unknown): Request {
	return new Request('https://worker.test/gmail/watch/activate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('handleGmailWatchActivate', () => {
	beforeEach(() => {
		mockedActivateMailboxWatch.mockReset();
	});

	it('returns 400 for invalid JSON payload', async () => {
		const request = new Request('https://worker.test/gmail/watch/activate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'invalid-json'
		});

		const response = await handleGmailWatchActivate(request, makeTestEnv());
		expect(response.status).toBe(400);
	});

	it('returns 400 when gmail_user is missing', async () => {
		const response = await handleGmailWatchActivate(makeRequest({}), makeTestEnv());
		expect(response.status).toBe(400);
	});

	it('returns 500 when activation boundary fails', async () => {
		mockedActivateMailboxWatch.mockResolvedValue({
			gmail_user: 'speaker@christophholz.com',
			ok: false,
			status: 'activation_failed',
			error: 'watch failed'
		});

		const response = await handleGmailWatchActivate(
			makeRequest({ gmail_user: 'speaker@christophholz.com' }),
			makeTestEnv()
		);
		expect(response.status).toBe(500);
	});

	it('returns activation details when boundary succeeds', async () => {
		mockedActivateMailboxWatch.mockResolvedValue({
			gmail_user: 'speaker@christophholz.com',
			ok: true,
			status: 'active',
			history_id: '123',
			watch_expiration: '2026-04-18T00:00:00.000Z'
		});

		const response = await handleGmailWatchActivate(
			makeRequest({ gmail_user: 'speaker@christophholz.com' }),
			makeTestEnv()
		);
		const json = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(json.ok).toBe(true);
		expect(json.history_id).toBe('123');
		expect(mockedActivateMailboxWatch).toHaveBeenCalledWith(expect.any(Object), {
			gmailUser: 'speaker@christophholz.com'
		});
	});
});
