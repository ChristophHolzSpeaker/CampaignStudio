import { type WorkerEnv, type WorkerExecutionContext } from '../lib/env';
import { json } from '../lib/http';
import { touchMailboxPush } from '../lib/gmail/history-sync';
import { parsePubSubPushEnvelope } from '../lib/gmail/pubsub';
import { triggerMailboxSync } from '../lib/gmail/trigger-sync';

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
		console.warn('gmail_push_invalid_json_payload', {
			path: new URL(request.url).pathname
		});
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const parsedPush = parsePubSubPushEnvelope(payload);
	if (!parsedPush.ok) {
		console.warn('gmail_push_malformed_envelope', {
			code: parsedPush.code,
			error: parsedPush.error,
			details: parsedPush.details
		});

		if (parsedPush.code === 'invalid_notification_payload') {
			return json({
				ok: true,
				accepted: true,
				sync_triggered: false,
				reason: 'malformed_notification_payload'
			});
		}

		return json(
			{
				ok: false,
				error: parsedPush.error,
				details: parsedPush.details
			},
			parsedPush.status
		);
	}

	const { envelope, emailAddress, historyId } = parsedPush.value;

	console.log('gmail_push_received', {
		subscription: envelope.subscription,
		message_id: envelope.message.messageId,
		publish_time: envelope.message.publishTime,
		email_address: emailAddress,
		history_id: historyId
	});

	if (!emailAddress || !historyId) {
		console.warn('gmail_push_incomplete_notification', {
			message_id: envelope.message.messageId,
			subscription: envelope.subscription,
			email_address: emailAddress,
			history_id: historyId
		});

		return json({
			ok: true,
			accepted: true,
			sync_triggered: false,
			reason: 'incomplete_notification'
		});
	}

	const cursor = await touchMailboxPush(env, {
		gmailUser: emailAddress,
		historyId
	});

	console.log('gmail_push_cursor_touch_result', {
		gmail_user: emailAddress,
		history_id: historyId,
		cursor_found: cursor !== null
	});

	if (!cursor) {
		console.warn('gmail_push_cursor_missing', {
			gmail_user: emailAddress,
			history_id: historyId,
			message_id: envelope.message.messageId
		});
		return json({ ok: true, accepted: true, sync_triggered: false, reason: 'cursor_missing' });
	}

	const triggerResult = triggerMailboxSync(env, ctx, {
		gmailUser: emailAddress,
		historyId
	});

	console.log('gmail_push_sync_triggered', {
		gmail_user: emailAddress,
		history_id: historyId,
		trigger_status: triggerResult.status
	});

	return json({
		ok: true,
		accepted: true,
		sync_triggered: true,
		gmail_user: emailAddress,
		history_id: historyId
	});
}
