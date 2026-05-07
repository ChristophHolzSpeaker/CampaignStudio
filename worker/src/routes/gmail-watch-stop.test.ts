import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../test/helpers';

vi.mock('../lib/gmail/client', () => ({
	gmailStop: vi.fn()
}));

import { gmailStop } from '../lib/gmail/client';
import { handleGmailWatchStop } from './gmail-watch-stop';

const mockedGmailStop = vi.mocked(gmailStop);

function makeRequest(body: unknown): Request {
	return new Request('https://worker.test/gmail/watch/stop', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('handleGmailWatchStop', () => {
	beforeEach(() => {
		mockedGmailStop.mockReset();
		mockedGmailStop.mockResolvedValue({});
	});

	it('returns 400 for invalid JSON payload', async () => {
		const request = new Request('https://worker.test/gmail/watch/stop', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'invalid-json'
		});

		const response = await handleGmailWatchStop(request, makeTestEnv());
		expect(response.status).toBe(400);
	});

	it('returns 400 when gmail_user is missing', async () => {
		const response = await handleGmailWatchStop(makeRequest({}), makeTestEnv());
		expect(response.status).toBe(400);
	});

	it('calls gmail stop and returns stopped status', async () => {
		const response = await handleGmailWatchStop(
			makeRequest({ gmail_user: 'podcast@christophholz.com' }),
			makeTestEnv()
		);
		const responseBody = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(responseBody).toEqual({
			ok: true,
			gmail_user: 'podcast@christophholz.com',
			status: 'stopped'
		});
		expect(mockedGmailStop).toHaveBeenCalledWith(expect.any(Object), {
			gmailUser: 'podcast@christophholz.com'
		});
	});
});
