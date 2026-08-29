import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBase64Url, makeTestEnv } from '../../test/helpers';

vi.mock('../db', () => ({
	insertOne: vi.fn(),
	selectOne: vi.fn(),
	upsertOne: vi.fn()
}));

vi.mock('./client', () => ({
	gmailSendMessage: vi.fn()
}));

import { insertOne, selectOne, upsertOne } from '../db';
import { gmailSendMessage } from './client';
import { sendOutboundEmail } from './send';

const mockedInsertOne = vi.mocked(insertOne);
const mockedSelectOne = vi.mocked(selectOne);
const mockedUpsertOne = vi.mocked(upsertOne);
const mockedGmailSendMessage = vi.mocked(gmailSendMessage);

function decodeEncodedSubject(mime: string): string {
	const subjectHeader = mime.match(/^Subject: ([^\r\n]*(?:\r\n [^\r\n]*)*)/m)?.[1] ?? '';
	const encodedWords = [...subjectHeader.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/gi)];

	return encodedWords
		.map((match) => {
			const bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0));
			return new TextDecoder().decode(bytes);
		})
		.join('');
}

describe('sendOutboundEmail', () => {
	beforeEach(() => {
		mockedInsertOne.mockReset();
		mockedSelectOne.mockReset();
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
		mockedUpsertOne.mockResolvedValue({ id: 'lead_message_1' });

		const result = await sendOutboundEmail(makeTestEnv(), {
			leadJourneyId: 'journey_1',
			gmailUser: 'speaker@christophholz.com',
			fromEmail: 'speakerlp@christophholz.com',
			to: ['Client@Example.com', 'client@example.com'],
			subject: 'Hello\nInjected',
			bodyText: 'Plain body',
			bodyHtml: '<p>HTML body</p>',
			threadId: 'thread_1',
			inReplyTo: '<message@id>',
			references: ['<ref-1@id>', '<ref-2@id>']
		});

		expect(result).toEqual({
			lead_message_id: 'lead_message_1',
			provider_message_id: 'msg_sent_1',
			provider_thread_id: 'thread_1'
		});
		expect(mockedGmailSendMessage).toHaveBeenCalledTimes(1);
		expect(mockedUpsertOne).toHaveBeenCalledTimes(1);
		expect(mockedInsertOne).toHaveBeenCalledTimes(1);

		const rawArg = mockedGmailSendMessage.mock.calls[0]?.[1]?.raw;
		const decodedMime = decodeBase64Url(String(rawArg));
		expect(decodedMime).toContain('From: speakerlp@christophholz.com');
		expect(decodedMime).toContain('Subject: Hello Injected');
		expect(decodedMime).toContain('To: client@example.com');
		expect(decodedMime).toContain(
			'Content-Type: multipart/alternative; boundary="gmail-worker-11111111-2222-4333-8444-555555555555"'
		);
		expect(decodedMime).toContain('In-Reply-To: <message@id>');
		expect(decodedMime).toContain('References: <ref-1@id> <ref-2@id>');
		expect(mockedUpsertOne).toHaveBeenCalledWith(
			expect.any(Object),
			'lead_messages',
			expect.objectContaining({ from_email: 'speakerlp@christophholz.com' }),
			expect.any(Object)
		);
	});

	it('sends email without lead journey and skips lead_messages persistence', async () => {
		mockedGmailSendMessage.mockResolvedValue({ id: 'msg_sent_2', threadId: 'thread_2' });

		const result = await sendOutboundEmail(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			to: ['person@example.com'],
			subject: 'General booking confirmation',
			bodyText: 'Body',
			leadJourneyId: null
		});

		expect(result).toEqual({
			lead_message_id: null,
			provider_message_id: 'msg_sent_2',
			provider_thread_id: 'thread_2'
		});
		expect(mockedUpsertOne).not.toHaveBeenCalled();
		expect(mockedInsertOne).toHaveBeenCalledTimes(1);
	});

	it('RFC 2047 encodes a non-ASCII subject before sending it to Gmail', async () => {
		mockedGmailSendMessage.mockResolvedValue({ id: 'msg_sent_3', threadId: 'thread_3' });
		mockedUpsertOne.mockResolvedValue({ id: 'lead_message_3' });
		const subject = 'Ihre Buchungsanfrage ist eingegangen – wählen Sie Ihren Termin';

		await sendOutboundEmail(makeTestEnv(), {
			leadJourneyId: 'journey_3',
			gmailUser: 'speaker@christophholz.com',
			to: ['lead@example.com'],
			subject,
			bodyText: 'Text'
		});

		const rawArg = mockedGmailSendMessage.mock.calls[0]?.[1]?.raw;
		const decodedMime = decodeBase64Url(String(rawArg));
		expect(decodedMime).not.toContain(`Subject: ${subject}`);
		expect(decodedMime).toMatch(/^Subject: =\?UTF-8\?B\?/m);
		expect(decodeEncodedSubject(decodedMime)).toBe(subject);
	});
});
