import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBase64Url, makeTestEnv } from '../../test/helpers';

vi.mock('../db', () => ({
	insertOne: vi.fn(),
	upsertOne: vi.fn()
}));

vi.mock('./client', () => ({
	gmailSendMessage: vi.fn()
}));

import { insertOne, upsertOne } from '../db';
import { gmailSendMessage } from './client';
import { sendOutboundEmail } from './send';

const mockedInsertOne = vi.mocked(insertOne);
const mockedUpsertOne = vi.mocked(upsertOne);
const mockedGmailSendMessage = vi.mocked(gmailSendMessage);

describe('sendOutboundEmail', () => {
	beforeEach(() => {
		mockedInsertOne.mockReset();
		mockedUpsertOne.mockReset();
		mockedGmailSendMessage.mockReset();
		vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
			'11111111-2222-4333-8444-555555555555'
		);
	});

	it('throws when recipients normalize to empty', async () => {
		await expect(
			sendOutboundEmail(makeTestEnv(), {
				leadJourneyId: 'journey_1',
				gmailUser: 'speaker@christophholz.com',
				to: ['not-an-email'],
				subject: 'Subject',
				bodyText: 'Body'
			})
		).rejects.toThrow('Outbound email requires at least one valid recipient');
	});

	it('sends email and persists lead_message + lead_event', async () => {
		mockedGmailSendMessage.mockResolvedValue({ id: 'msg_sent_1', threadId: 'thread_1' });

		const result = await sendOutboundEmail(makeTestEnv(), {
			leadJourneyId: 'journey_1',
			gmailUser: 'speaker@christophholz.com',
			to: ['Client@Example.com', 'client@example.com'],
			subject: 'Hello\nInjected',
			bodyText: 'Plain body',
			bodyHtml: '<p>HTML body</p>',
			threadId: 'thread_1',
			inReplyTo: '<message@id>',
			references: ['<ref-1@id>', '<ref-2@id>']
		});

		expect(result).toEqual({ provider_message_id: 'msg_sent_1', provider_thread_id: 'thread_1' });
		expect(mockedGmailSendMessage).toHaveBeenCalledTimes(1);
		expect(mockedUpsertOne).toHaveBeenCalledTimes(1);
		expect(mockedInsertOne).toHaveBeenCalledTimes(1);

		const rawArg = mockedGmailSendMessage.mock.calls[0]?.[1]?.raw;
		const decodedMime = decodeBase64Url(String(rawArg));
		expect(decodedMime).toContain('Subject: Hello Injected');
		expect(decodedMime).toContain('To: client@example.com');
		expect(decodedMime).toContain(
			'Content-Type: multipart/alternative; boundary="gmail-worker-11111111-2222-4333-8444-555555555555"'
		);
		expect(decodedMime).toContain('In-Reply-To: <message@id>');
		expect(decodedMime).toContain('References: <ref-1@id> <ref-2@id>');
	});
});
