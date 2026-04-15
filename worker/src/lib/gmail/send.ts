import { insertOne, upsertOne } from '../db';
import type { WorkerEnv } from '../env';
import { normalizeEmailAddress } from '../email';
import { gmailSendMessage } from './client';

type SendOutboundEmailInput = {
	leadJourneyId: string;
	gmailUser: string;
	to: string[];
	subject: string;
	bodyText: string;
	bodyHtml?: string;
	threadId?: string;
	inReplyTo?: string;
	references?: string[];
};

type SendOutboundEmailResult = {
	provider_message_id: string;
	provider_thread_id: string;
};

function toBase64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function sanitizeHeader(value: string): string {
	return value.replace(/[\r\n]+/g, ' ').trim();
}

function buildMimeMessage(input: SendOutboundEmailInput): string {
	const toHeader = input.to.join(', ');
	const fromHeader = input.gmailUser;
	const subject = sanitizeHeader(input.subject);
	const dateHeader = new Date().toUTCString();

	const lines: string[] = [
		`From: ${fromHeader}`,
		`To: ${toHeader}`,
		`Subject: ${subject}`,
		`Date: ${dateHeader}`,
		'MIME-Version: 1.0'
	];

	if (input.inReplyTo) {
		lines.push(`In-Reply-To: ${sanitizeHeader(input.inReplyTo)}`);
	}

	if (input.references && input.references.length > 0) {
		lines.push(`References: ${input.references.map((value) => sanitizeHeader(value)).join(' ')}`);
	}

	if (input.bodyHtml) {
		const boundary = `gmail-worker-${crypto.randomUUID()}`;
		lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`, '');
		lines.push(`--${boundary}`);
		lines.push('Content-Type: text/plain; charset="UTF-8"', '', input.bodyText, '');
		lines.push(`--${boundary}`);
		lines.push('Content-Type: text/html; charset="UTF-8"', '', input.bodyHtml, '');
		lines.push(`--${boundary}--`);
	} else {
		lines.push('Content-Type: text/plain; charset="UTF-8"', '', input.bodyText);
	}

	return lines.join('\r\n');
}

function normalizeRecipients(recipients: string[]): string[] {
	const normalized = recipients
		.map((value) => normalizeEmailAddress(value))
		.filter((value): value is string => value !== null);
	return [...new Set(normalized)];
}

export async function sendOutboundEmail(
	env: WorkerEnv,
	input: SendOutboundEmailInput
): Promise<SendOutboundEmailResult> {
	const recipients = normalizeRecipients(input.to);
	if (recipients.length === 0) {
		throw new Error('Outbound email requires at least one valid recipient');
	}

	const mime = buildMimeMessage({
		...input,
		to: recipients
	});

	const sent = await gmailSendMessage(env, {
		gmailUser: input.gmailUser,
		raw: toBase64Url(mime),
		threadId: input.threadId
	});

	const nowIso = new Date().toISOString();

	await upsertOne(
		env,
		'lead_messages',
		{
			lead_journey_id: input.leadJourneyId,
			direction: 'outbound',
			provider: 'gmail',
			provider_message_id: sent.id,
			provider_thread_id: sent.threadId,
			from_email: input.gmailUser,
			to_email: recipients.join(','),
			subject: input.subject,
			body_text: input.bodyText,
			body_html: input.bodyHtml ?? null,
			classification: null,
			classification_confidence: null,
			auto_response_decision: null,
			auto_response_sent_at: null,
			received_at: null,
			sent_at: nowIso,
			raw_metadata: {
				gmail: {
					id: sent.id,
					threadId: sent.threadId,
					inReplyTo: input.inReplyTo ?? null,
					references: input.references ?? [],
					mime_preview: mime.slice(0, 2000)
				}
			},
			updated_at: nowIso
		},
		{
			onConflict: 'provider_message_id'
		}
	);

	await insertOne(env, 'lead_events', {
		lead_journey_id: input.leadJourneyId,
		campaign_id: null,
		campaign_page_id: null,
		event_type: 'email_sent',
		event_source: 'worker.gmail_send',
		event_payload: {
			provider: 'gmail',
			provider_message_id: sent.id,
			provider_thread_id: sent.threadId,
			recipients
		}
	});

	return {
		provider_message_id: sent.id,
		provider_thread_id: sent.threadId
	};
}

export type { SendOutboundEmailInput, SendOutboundEmailResult };
