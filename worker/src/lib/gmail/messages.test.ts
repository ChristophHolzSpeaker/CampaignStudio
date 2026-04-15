import { describe, expect, it } from 'vitest';
import { normalizeGmailMessage } from './messages';

function toBase64Url(value: string): string {
	return Buffer.from(value, 'utf8')
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

describe('normalizeGmailMessage', () => {
	it('returns null when id or threadId is missing', () => {
		expect(
			normalizeGmailMessage({ id: '', threadId: 'thread' } as never, 'speaker@example.com')
		).toBeNull();
		expect(
			normalizeGmailMessage({ id: 'id', threadId: '' } as never, 'speaker@example.com')
		).toBeNull();
	});

	it('normalizes inbound messages with decoded plain text and html', () => {
		const message = {
			id: 'msg_1',
			threadId: 'thread_1',
			internalDate: '1713268800000',
			historyId: '100',
			snippet: 'Hello',
			labelIds: ['INBOX'],
			payload: {
				headers: [
					{ name: 'From', value: 'Jane Doe <jane@example.com>' },
					{ name: 'To', value: 'speaker+cmp12_cp3@christophholz.com' },
					{ name: 'Subject', value: 'Speaking inquiry' }
				],
				parts: [
					{ mimeType: 'text/plain', body: { data: toBase64Url('Hello team') } },
					{ mimeType: 'text/html', body: { data: toBase64Url('<p>Hello team</p>') } }
				]
			}
		};

		const normalized = normalizeGmailMessage(message as never, 'speaker@christophholz.com');
		expect(normalized).not.toBeNull();
		expect(normalized?.direction).toBe('inbound');
		expect(normalized?.from_email).toBe('jane@example.com');
		expect(normalized?.from_name).toBe('Jane Doe');
		expect(normalized?.to_recipients).toEqual(['speaker+cmp12_cp3@christophholz.com']);
		expect(normalized?.body_text).toBe('Hello team');
		expect(normalized?.body_html).toBe('<p>Hello team</p>');
		expect(normalized?.received_at).toBe('2024-04-16T12:00:00.000Z');
		expect(normalized?.contact_email).toBe('jane@example.com');
	});

	it('marks outbound when sender matches gmail user and derives contact recipient', () => {
		const message = {
			id: 'msg_2',
			threadId: 'thread_2',
			internalDate: '1713268800000',
			payload: {
				headers: [
					{ name: 'From', value: 'Speaker <speaker@christophholz.com>' },
					{ name: 'To', value: 'client@example.com' },
					{ name: 'Subject', value: 'Re: Inquiry' }
				],
				parts: [{ mimeType: 'text/plain', body: { data: toBase64Url('Thanks') } }]
			}
		};

		const normalized = normalizeGmailMessage(message as never, 'speaker@christophholz.com');
		expect(normalized?.direction).toBe('outbound');
		expect(normalized?.sent_at).toBe('2024-04-16T12:00:00.000Z');
		expect(normalized?.contact_email).toBe('client@example.com');
	});

	it('falls back to text extracted from html when plain text is unavailable', () => {
		const message = {
			id: 'msg_3',
			threadId: 'thread_3',
			payload: {
				headers: [
					{ name: 'From', value: 'jane@example.com' },
					{ name: 'To', value: 'speaker@christophholz.com' }
				],
				parts: [{ mimeType: 'text/html', body: { data: toBase64Url('<p>Hello <b>there</b></p>') } }]
			}
		};

		const normalized = normalizeGmailMessage(message as never, 'speaker@christophholz.com');
		expect(normalized?.body_text).toBe('Hello there');
		expect(normalized?.subject).toBe('(no subject)');
	});
});
