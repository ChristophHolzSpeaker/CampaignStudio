import { normalizeEmailAddress } from '../email';
import type { GmailHeader, GmailMessage, GmailMessagePart } from './client';

export type NormalizedGmailMessage = {
	provider_message_id: string;
	provider_thread_id: string;
	from_email: string;
	to_email: string;
	subject: string;
	body_text: string;
	body_html: string | null;
	received_at: string | null;
	sent_at: string | null;
	raw_metadata: Record<string, unknown>;
	contact_email: string | null;
	direction: 'inbound' | 'outbound';
};

function decodeBase64Url(value: string): string {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padLength = (4 - (normalized.length % 4)) % 4;
	const padded = `${normalized}${'='.repeat(padLength)}`;
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return new TextDecoder().decode(bytes);
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string | null {
	const header = headers?.find((candidate) => candidate.name?.toLowerCase() === name.toLowerCase());
	const value = header?.value?.trim();
	return value ? value : null;
}

function extractEmails(value: string | null): string[] {
	if (!value) {
		return [];
	}
	const matches = value.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
	if (!matches) {
		return [];
	}
	const normalized = matches
		.map((email) => normalizeEmailAddress(email))
		.filter((email): email is string => email !== null);
	return [...new Set(normalized)];
}

function flattenParts(part: GmailMessagePart | undefined): GmailMessagePart[] {
	if (!part) {
		return [];
	}
	const nested = (part.parts ?? []).flatMap((child) => flattenParts(child));
	return [part, ...nested];
}

function extractBodyParts(payload: GmailMessagePart | undefined): {
	bodyText: string;
	bodyHtml: string | null;
} {
	const parts = flattenParts(payload);
	let bodyText: string | null = null;
	let bodyHtml: string | null = null;

	for (const part of parts) {
		const mimeType = part.mimeType?.toLowerCase();
		const data = part.body?.data;
		if (!mimeType || !data) {
			continue;
		}

		let decoded = '';
		try {
			decoded = decodeBase64Url(data);
		} catch {
			decoded = '';
		}

		if (!decoded) {
			continue;
		}

		if (mimeType === 'text/plain' && !bodyText) {
			bodyText = decoded;
		}

		if (mimeType === 'text/html' && !bodyHtml) {
			bodyHtml = decoded;
		}
	}

	if (!bodyText && bodyHtml) {
		bodyText = bodyHtml
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	return {
		bodyText: bodyText?.trim() || '',
		bodyHtml: bodyHtml?.trim() || null
	};
}

function parseMessageTimestamp(message: GmailMessage): string | null {
	if (!message.internalDate) {
		return null;
	}
	const ms = Number(message.internalDate);
	if (!Number.isFinite(ms) || ms <= 0) {
		return null;
	}
	return new Date(ms).toISOString();
}

function includesEmail(emails: string[], target: string): boolean {
	const normalizedTarget = normalizeEmailAddress(target);
	if (!normalizedTarget) {
		return false;
	}
	return emails.includes(normalizedTarget);
}

export function normalizeGmailMessage(
	message: GmailMessage,
	gmailUser: string
): NormalizedGmailMessage | null {
	if (!message.id || !message.threadId) {
		return null;
	}

	const headers = message.payload?.headers;
	const fromRaw = getHeader(headers, 'From');
	const toRaw = getHeader(headers, 'To');
	const subject = getHeader(headers, 'Subject') ?? '(no subject)';
	const timestamp = parseMessageTimestamp(message);
	const { bodyText, bodyHtml } = extractBodyParts(message.payload);

	const fromEmails = extractEmails(fromRaw);
	const toEmails = extractEmails(toRaw);
	const fromEmail = fromEmails[0] ?? '';
	const toEmail = toEmails.join(',');

	const outbound = includesEmail(fromEmails, gmailUser);
	const direction: 'inbound' | 'outbound' = outbound ? 'outbound' : 'inbound';
	const contactEmail = outbound ? (toEmails[0] ?? null) : (fromEmails[0] ?? null);

	return {
		provider_message_id: message.id,
		provider_thread_id: message.threadId,
		from_email: fromEmail,
		to_email: toEmail,
		subject,
		body_text: bodyText,
		body_html: bodyHtml,
		received_at: direction === 'inbound' ? timestamp : null,
		sent_at: direction === 'outbound' ? timestamp : null,
		raw_metadata: {
			gmail: {
				id: message.id,
				threadId: message.threadId,
				historyId: message.historyId,
				internalDate: message.internalDate,
				labelIds: message.labelIds,
				snippet: message.snippet,
				headers: headers ?? []
			}
		},
		contact_email: contactEmail,
		direction
	};
}
