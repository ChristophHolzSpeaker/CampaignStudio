import { insertOne, selectOne, upsertOne } from '../db';
import type { WorkerEnv } from '../env';
import { normalizeEmailAddress } from '../email';
import { logLeadEvent } from '../analytics/lead-events';
import { gmailSendMessage } from './client';

type SendOutboundEmailInput = {
	leadJourneyId?: string | null;
	gmailUser: string;
	fromEmail?: string;
	to: string[];
	subject: string;
	bodyText: string;
	bodyHtml?: string;
	threadId?: string;
	inReplyTo?: string;
	references?: string[];
	autoResponseDecision?: string | null;
	campaignId?: number | null;
	campaignPageId?: number | null;
	rawMetadata?: Record<string, unknown>;
};

type SendOutboundEmailResult = {
	lead_message_id: string | null;
	provider_message_id: string;
	provider_thread_id: string;
};

type PersistedLeadMessageRow = {
	id: string;
};

function toBase64(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function toBase64Url(value: string): string {
	return toBase64(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function sanitizeHeader(value: string): string {
	return value.replace(/[\r\n]+/g, ' ').trim();
}

function encodeSubjectHeader(value: string): string {
	const sanitized = sanitizeHeader(value);
	if (/^[\x20-\x7e]*$/.test(sanitized)) {
		return sanitized;
	}

	const chunks: string[] = [];
	let chunk = '';
	for (const character of sanitized) {
		const candidate = `${chunk}${character}`;
		if (chunk && new TextEncoder().encode(candidate).length > 45) {
			chunks.push(chunk);
			chunk = character;
		} else {
			chunk = candidate;
		}
	}
	if (chunk) {
		chunks.push(chunk);
	}

	return chunks.map((part) => `=?UTF-8?B?${toBase64(part)}?=`).join('\r\n ');
}

function buildMimeMessage(input: SendOutboundEmailInput): string {
	const toHeader = input.to.join(', ');
	const fromHeader = input.fromEmail ?? input.gmailUser;
	const subject = encodeSubjectHeader(input.subject);
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
	const fromEmail = normalizeEmailAddress(input.fromEmail ?? input.gmailUser);
	if (!fromEmail) {
		throw new Error('Outbound email requires a valid sender');
	}

	const mime = buildMimeMessage({
		...input,
		fromEmail,
		to: recipients
	});

	const sent = await gmailSendMessage(env, {
		gmailUser: input.gmailUser,
		raw: toBase64Url(mime),
		threadId: input.threadId
	});

	const nowIso = new Date().toISOString();

	let leadMessageId: string | null = null;
	if (input.leadJourneyId) {
		const persisted = await upsertOne<PersistedLeadMessageRow>(
			env,
			'lead_messages',
			{
				lead_journey_id: input.leadJourneyId,
				direction: 'outbound',
				provider: 'gmail',
				provider_message_id: sent.id,
				provider_thread_id: sent.threadId,
				from_email: fromEmail,
				to_email: recipients.join(','),
				subject: input.subject,
				body_text: input.bodyText,
				body_html: input.bodyHtml ?? null,
				classification: null,
				classification_confidence: null,
				auto_response_decision: input.autoResponseDecision ?? null,
				auto_response_sent_at: null,
				received_at: null,
				sent_at: nowIso,
				raw_metadata: {
					...(input.rawMetadata ?? {}),
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

		leadMessageId = persisted?.id ?? null;
		if (!leadMessageId) {
			const query = new URLSearchParams({
				select: 'id',
				provider_message_id: `eq.${sent.id}`,
				limit: '1'
			});
			const existing = await selectOne<PersistedLeadMessageRow>(env, 'lead_messages', query);
			leadMessageId = existing?.id ?? null;
		}
	}

	const analyticsEventType =
		input.autoResponseDecision === 'autoresponse_sent' ? 'auto_reply_sent' : 'manual_reply_sent';

	await logLeadEvent(env, {
		lead_journey_id: input.leadJourneyId ?? null,
		campaign_id: input.campaignId ?? null,
		campaign_page_id: input.campaignPageId ?? null,
		event_type: analyticsEventType,
		event_source: 'worker.gmail_send',
		event_payload: {
			legacy_event_type: 'email_sent',
			provider: 'gmail',
			provider_message_id: sent.id,
			provider_thread_id: sent.threadId,
			recipients,
			from_email: fromEmail,
			auto_response_decision: input.autoResponseDecision ?? null
		}
	});

	return {
		lead_message_id: leadMessageId,
		provider_message_id: sent.id,
		provider_thread_id: sent.threadId
	};
}

export type { SendOutboundEmailInput, SendOutboundEmailResult };
