import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../../test/helpers';

vi.mock('./auth', () => ({
	getGmailAccessToken: vi.fn()
}));

import { getGmailAccessToken } from './auth';
import {
	GmailApiError,
	gmailCreateLabel,
	gmailEnsureLabel,
	gmailGetMessage,
	gmailListHistory,
	gmailListLabels,
	gmailModifyMessage,
	gmailSendMessage,
	gmailStop,
	gmailWatch,
	isHistoryCursorStale
} from './client';

const mockedGetGmailAccessToken = vi.mocked(getGmailAccessToken);

describe('gmail client', () => {
	beforeEach(() => {
		mockedGetGmailAccessToken.mockReset();
		mockedGetGmailAccessToken.mockResolvedValue('token_123');
		vi.restoreAllMocks();
	});

	it('lists history with correct query params', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify({ history: [], historyId: '123' }), { status: 200 })
			);

		await gmailListHistory(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			startHistoryId: '100',
			pageToken: 'next_1'
		});

		const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
		expect(calledUrl).toContain('/users/me/history');
		expect(calledUrl).toContain('startHistoryId=100');
		expect(calledUrl).toContain('pageToken=next_1');
		expect(calledUrl).toContain('historyTypes=messageAdded');
	});

	it('gets single message using encoded id', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify({ id: 'm1', threadId: 't1' }), { status: 200 })
			);

		await gmailGetMessage(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			messageId: 'm/with/slash'
		});

		const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
		expect(calledUrl).toContain('/users/me/messages/m%2Fwith%2Fslash');
		expect(calledUrl).toContain('format=full');
	});

	it('sends message with raw payload and optional thread id', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify({ id: 'sent_1', threadId: 'thread_1' }), { status: 200 })
			);

		await gmailSendMessage(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			raw: 'encoded-raw',
			threadId: 'thread_1'
		});

		const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
		expect(body).toEqual({ raw: 'encoded-raw', threadId: 'thread_1' });
	});

	it('calls watch endpoint with topic and labels', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ historyId: '200', expiration: '1714000000000' }), {
				status: 200
			})
		);

		await gmailWatch(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			topicName: 'projects/foo/topics/bar',
			labelIds: ['INBOX'],
			labelFilterAction: 'include'
		});

		const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
		expect(body).toEqual({
			topicName: 'projects/foo/topics/bar',
			labelIds: ['INBOX'],
			labelFilterBehavior: 'INCLUDE'
		});
	});

	it('prefers explicit labelFilterBehavior when provided', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ historyId: '200' }), { status: 200 }));

		await gmailWatch(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			topicName: 'projects/foo/topics/bar',
			labelFilterAction: 'exclude',
			labelFilterBehavior: 'INCLUDE'
		});

		const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
		expect(body.labelFilterBehavior).toBe('INCLUDE');
	});

	it('calls stop endpoint for mailbox watch unsubscribe', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(null, { status: 204 }));

		await gmailStop(makeTestEnv(), {
			gmailUser: 'podcast@christophholz.com'
		});

		const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
		expect(calledUrl).toContain('/users/me/stop');
		expect(fetchSpy.mock.calls[0]?.[1]?.method).toBe('POST');
	});

	it('lists labels for mailbox', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ labels: [{ id: 'Label_1', name: 'WOODY_PROCESSED' }] }), {
				status: 200
			})
		);

		const response = await gmailListLabels(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com'
		});

		expect(response.labels?.[0]?.name).toBe('WOODY_PROCESSED');
		const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
		expect(calledUrl).toContain('/users/me/labels');
	});

	it('creates user label for mailbox', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify({ id: 'Label_1', name: 'WOODY_PROCESSED' }), { status: 200 })
			);

		const label = await gmailCreateLabel(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			name: 'WOODY_PROCESSED'
		});

		expect(label.id).toBe('Label_1');
		const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
		expect(body).toEqual({
			name: 'WOODY_PROCESSED',
			labelListVisibility: 'labelShow',
			messageListVisibility: 'show'
		});
	});

	it('ensures label returns existing label without creating', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ labels: [{ id: 'Label_99', name: 'WOODY_PROCESSED' }] }), {
				status: 200
			})
		);

		const label = await gmailEnsureLabel(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			name: 'WOODY_PROCESSED'
		});

		expect(label.id).toBe('Label_99');
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it('ensures label creates when missing', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response(JSON.stringify({ labels: [] }), { status: 200 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ id: 'Label_101', name: 'WOODY_RESPONDED' }), { status: 200 })
			);

		const label = await gmailEnsureLabel(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			name: 'WOODY_RESPONDED'
		});

		expect(label.id).toBe('Label_101');
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it('modifies message labels', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ id: 'm1', threadId: 't1', labelIds: ['Label_1'] }), {
				status: 200
			})
		);

		await gmailModifyMessage(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			messageId: 'm/1',
			addLabelIds: ['Label_1']
		});

		const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
		expect(calledUrl).toContain('/users/me/messages/m%2F1/modify');
		const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
		expect(body).toEqual({ addLabelIds: ['Label_1'], removeLabelIds: [] });
	});

	it('throws GmailApiError with parsed response body on non-2xx', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ error: { message: 'invalid' } }), { status: 400 })
		);

		await expect(
			gmailListHistory(makeTestEnv(), {
				gmailUser: 'speaker@christophholz.com',
				startHistoryId: '100'
			})
		).rejects.toBeInstanceOf(GmailApiError);
	});

	it('detects stale history cursor correctly', () => {
		expect(isHistoryCursorStale(new GmailApiError(404, 'not found', {}))).toBe(true);
		expect(
			isHistoryCursorStale(new GmailApiError(400, 'bad request', { error: 'historyId is stale' }))
		).toBe(true);
		expect(isHistoryCursorStale(new GmailApiError(400, 'bad request', { error: 'other' }))).toBe(
			false
		);
		expect(isHistoryCursorStale(new Error('plain'))).toBe(false);
	});
});
