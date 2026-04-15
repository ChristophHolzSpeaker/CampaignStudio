import { z } from 'zod';
import { type WorkerEnv, type WorkerExecutionContext } from '../lib/env';
import { badRequestFromZod, json } from '../lib/http';
import { syncMailboxHistory, touchMailboxPush } from '../lib/gmail/history-sync';

const gmailPushEnvelopeSchema = z.object({
	message: z.object({
		data: z.string().min(1),
		messageId: z.string().optional(),
		publishTime: z.string().optional(),
		attributes: z.record(z.string(), z.string()).optional()
	}),
	subscription: z.string().optional()
});

const gmailPushPayloadSchema = z.object({
	emailAddress: z.string().trim().email().optional(),
	historyId: z.string().trim().optional()
});

function decodePubSubMessageData(data: string): string {
	const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
	const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
	return atob(`${normalized}${padding}`);
}

function safeEquals(left: string, right: string): boolean {
	if (left.length !== right.length) {
		return false;
	}
	let result = 0;
	for (let index = 0; index < left.length; index += 1) {
		result |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return result === 0;
}

export async function handleGmailPush(
	request: Request,
	env: WorkerEnv,
	ctx: WorkerExecutionContext
): Promise<Response> {
	const configuredToken = env.GMAIL_PUSH_VERIFICATION_TOKEN;
	if (configuredToken) {
		const token = new URL(request.url).searchParams.get('token');
		if (!token || !safeEquals(token, configuredToken)) {
			return json({ ok: false, error: 'Unauthorized push token' }, 401);
		}
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const envelope = gmailPushEnvelopeSchema.safeParse(payload);
	if (!envelope.success) {
		return badRequestFromZod(envelope.error);
	}

	let decodedData: string;
	try {
		decodedData = decodePubSubMessageData(envelope.data.message.data);
	} catch {
		return json({ ok: false, error: 'Invalid Pub/Sub message data encoding' }, 400);
	}

	let decodedPayload: unknown;
	try {
		decodedPayload = JSON.parse(decodedData);
	} catch {
		return json({ ok: false, error: 'Pub/Sub data is not valid JSON' }, 400);
	}

	const gmailPushPayload = gmailPushPayloadSchema.safeParse(decodedPayload);
	if (!gmailPushPayload.success) {
		return badRequestFromZod(gmailPushPayload.error);
	}

	const gmailUser =
		gmailPushPayload.data.emailAddress ?? envelope.data.message.attributes?.emailAddress ?? null;
	if (!gmailUser) {
		return json({ ok: false, error: 'Gmail user identifier missing from push payload' }, 400);
	}

	const historyId =
		gmailPushPayload.data.historyId ?? envelope.data.message.attributes?.historyId ?? null;

	const cursor = await touchMailboxPush(env, {
		gmailUser,
		historyId
	});

	if (!cursor) {
		console.warn('gmail_push_cursor_missing', {
			gmail_user: gmailUser,
			history_id: historyId,
			message_id: envelope.data.message.messageId
		});
		return json({ ok: true, accepted: true, sync_triggered: false, reason: 'cursor_missing' });
	}

	ctx.waitUntil(
		syncMailboxHistory(env, {
			gmailUser,
			hintedHistoryId: historyId
		})
			.then((result) => {
				console.log('gmail_push_sync_complete', {
					gmail_user: gmailUser,
					status: result.status,
					processed_messages: result.processed_messages,
					last_history_id: result.last_history_id
				});
			})
			.catch((error) => {
				console.error('gmail_push_sync_unhandled_error', {
					gmail_user: gmailUser,
					error: error instanceof Error ? error.message : 'unknown'
				});
			})
	);

	return json({
		ok: true,
		accepted: true,
		sync_triggered: true,
		gmail_user: gmailUser,
		history_id: historyId
	});
}
