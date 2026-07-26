import { selectMany, selectOne, updateMany } from '../db';
import type { WorkerEnv } from '../env';
import { GoogleAuthError } from '../google-auth/errors';
import {
	gmailGetMessage,
	gmailListHistory,
	gmailListMessages,
	isGmailMessageMissing,
	isHistoryCursorStale,
	type GmailMessage
} from './client';
import { normalizeGmailMessage } from './messages';
import { processInboundGmailMessage } from './process-inbound-message';

export type MailboxCursorRow = {
	id: string;
	gmail_user: string;
	last_processed_history_id: string;
	watch_expiration: string;
	last_watch_renewed_at?: string | null;
	last_push_received_at: string | null;
	last_sync_at: string | null;
	sync_status: string;
};

type SyncOutcome = {
	ok: boolean;
	status: 'active' | 'sync_failed' | 'resync_required';
	processed_messages: number;
	last_history_id: string;
};

const DEFAULT_RECOVERY_LOOKBACK_DAYS = 30;

function compareHistoryIds(left: string, right: string): number {
	try {
		const leftValue = BigInt(left);
		const rightValue = BigInt(right);
		if (leftValue === rightValue) return 0;
		return leftValue > rightValue ? 1 : -1;
	} catch {
		if (left === right) return 0;
		return left > right ? 1 : -1;
	}
}

function maxHistoryId(current: string, candidate: string | null | undefined): string {
	if (!candidate) {
		return current;
	}
	return compareHistoryIds(candidate, current) > 0 ? candidate : current;
}

async function updateCursor(
	env: WorkerEnv,
	gmailUser: string,
	values: Record<string, unknown>
): Promise<void> {
	const query = new URLSearchParams({
		select: 'id',
		gmail_user: `eq.${gmailUser}`,
		limit: '1'
	});
	await updateMany(env, 'mailbox_cursors', query, values);
}

export async function getMailboxCursor(
	env: WorkerEnv,
	gmailUser: string
): Promise<MailboxCursorRow | null> {
	const query = new URLSearchParams({
		select:
			'id,gmail_user,last_processed_history_id,watch_expiration,last_watch_renewed_at,last_push_received_at,last_sync_at,sync_status',
		gmail_user: `eq.${gmailUser}`,
		limit: '1'
	});
	return selectOne<MailboxCursorRow>(env, 'mailbox_cursors', query);
}

function resolveRecoveryLookbackDays(env: WorkerEnv): number {
	const parsed = Number(env.GMAIL_RECOVERY_LOOKBACK_DAYS);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_RECOVERY_LOOKBACK_DAYS;
	}
	return Math.floor(parsed);
}

async function persistFetchedMessage(
	env: WorkerEnv,
	gmailUser: string,
	gmailMessage: GmailMessage
): Promise<boolean> {
	const normalized = normalizeGmailMessage(gmailMessage, gmailUser);
	if (!normalized) {
		return false;
	}

	if (normalized.direction !== 'inbound') {
		return false;
	}

	const result = await processInboundGmailMessage(env, {
		gmailUser,
		gmailMessage
	});

	if (result.status === 'invalid_sender_email') {
		console.warn('gmail_inbound_invalid_sender_email', {
			provider_message_id: result.provider_message_id,
			provider_thread_id: result.provider_thread_id
		});
	}

	return result.status === 'processed';
}

async function collectHistoryMessageIds(
	env: WorkerEnv,
	gmailUser: string,
	startHistoryId: string
): Promise<{ messageIds: string[]; lastHistoryId: string }> {
	const collected = new Set<string>();
	let nextPageToken: string | undefined;
	let latestHistoryId = startHistoryId;

	do {
		const response = await gmailListHistory(env, {
			gmailUser,
			startHistoryId,
			pageToken: nextPageToken
		});

		for (const historyItem of response.history ?? []) {
			latestHistoryId = maxHistoryId(latestHistoryId, historyItem.id);
			for (const added of historyItem.messagesAdded ?? []) {
				const messageId = added.message?.id;
				if (messageId) {
					collected.add(messageId);
				}
			}
		}

		latestHistoryId = maxHistoryId(latestHistoryId, response.historyId);
		nextPageToken = response.nextPageToken;
	} while (nextPageToken);

	return {
		messageIds: [...collected],
		lastHistoryId: latestHistoryId
	};
}

export async function recoverMailboxMessages(
	env: WorkerEnv,
	params: {
		gmailUser: string;
	}
): Promise<number> {
	const lookbackDays = resolveRecoveryLookbackDays(env);
	let nextPageToken: string | undefined;
	let processed = 0;

	do {
		const response = await gmailListMessages(env, {
			gmailUser: params.gmailUser,
			query: `newer_than:${lookbackDays}d`,
			labelIds: ['INBOX'],
			pageToken: nextPageToken
		});

		for (const message of response.messages ?? []) {
			if (!message.id) {
				continue;
			}

			try {
				const gmailMessage = await gmailGetMessage(env, {
					gmailUser: params.gmailUser,
					messageId: message.id
				});
				if (await persistFetchedMessage(env, params.gmailUser, gmailMessage)) {
					processed += 1;
				}
			} catch (error) {
				if (!isGmailMessageMissing(error)) {
					throw error;
				}

				console.warn('gmail_recovery_message_missing', {
					gmail_user: params.gmailUser,
					message_id: message.id,
					action: 'skipped'
				});
			}
		}

		nextPageToken = response.nextPageToken;
	} while (nextPageToken);

	console.log('gmail_recovery_backfill_completed', {
		gmail_user: params.gmailUser,
		lookback_days: lookbackDays,
		processed_messages: processed
	});

	return processed;
}

export async function syncMailboxHistory(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		hintedHistoryId?: string | null;
	}
): Promise<SyncOutcome> {
	const nowIso = new Date().toISOString();
	const cursor = await getMailboxCursor(env, params.gmailUser);
	if (!cursor) {
		throw new Error(`Mailbox cursor not found for user: ${params.gmailUser}`);
	}

	const startHistoryId = cursor.last_processed_history_id;

	try {
		const historyResult = await collectHistoryMessageIds(env, params.gmailUser, startHistoryId);
		let processed = 0;

		for (const messageId of historyResult.messageIds) {
			try {
				const gmailMessage = await gmailGetMessage(env, {
					gmailUser: params.gmailUser,
					messageId
				});
				const inserted = await persistFetchedMessage(env, params.gmailUser, gmailMessage);
				if (inserted) {
					processed += 1;
				}
			} catch (error) {
				if (!isGmailMessageMissing(error)) {
					throw error;
				}

				console.warn('gmail_history_message_missing', {
					gmail_user: params.gmailUser,
					message_id: messageId,
					action: 'skipped'
				});
			}
		}

		const nextHistoryId = maxHistoryId(
			historyResult.lastHistoryId,
			params.hintedHistoryId ?? cursor.last_processed_history_id
		);

		await updateCursor(env, params.gmailUser, {
			last_processed_history_id: nextHistoryId,
			last_sync_at: nowIso,
			sync_status: 'active',
			updated_at: nowIso
		});

		return {
			ok: true,
			status: 'active',
			processed_messages: processed,
			last_history_id: nextHistoryId
		};
	} catch (error) {
		const authDetails =
			error instanceof GoogleAuthError
				? {
						error_code: error.code,
						google_status:
							typeof error.details?.status === 'number' ? error.details.status : undefined,
						google_response: error.details?.response
					}
				: {};

		if (isHistoryCursorStale(error)) {
			await updateCursor(env, params.gmailUser, {
				sync_status: 'resync_required',
				last_sync_at: nowIso,
				updated_at: nowIso
			});

			console.error('gmail_sync_resync_required', {
				gmail_user: params.gmailUser,
				error: error instanceof Error ? error.message : 'unknown',
				...authDetails
			});

			return {
				ok: false,
				status: 'resync_required',
				processed_messages: 0,
				last_history_id: startHistoryId
			};
		}

		await updateCursor(env, params.gmailUser, {
			sync_status: 'sync_failed',
			last_sync_at: nowIso,
			updated_at: nowIso
		});

		console.error('gmail_sync_failed', {
			gmail_user: params.gmailUser,
			error: error instanceof Error ? error.message : 'unknown',
			...authDetails
		});

		return {
			ok: false,
			status: 'sync_failed',
			processed_messages: 0,
			last_history_id: startHistoryId
		};
	}
}

export async function touchMailboxPush(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		historyId?: string | null;
	}
): Promise<MailboxCursorRow | null> {
	const nowIso = new Date().toISOString();
	const existing = await getMailboxCursor(env, params.gmailUser);

	if (!existing) {
		return null;
	}

	await updateCursor(env, params.gmailUser, {
		last_push_received_at: nowIso,
		last_processed_history_id: existing.last_processed_history_id,
		updated_at: nowIso
	});

	return {
		...existing,
		last_push_received_at: nowIso
	};
}

export async function listMailboxCursors(env: WorkerEnv): Promise<MailboxCursorRow[]> {
	const query = new URLSearchParams({
		select:
			'id,gmail_user,last_processed_history_id,watch_expiration,last_watch_renewed_at,last_push_received_at,last_sync_at,sync_status',
		order: 'gmail_user.asc'
	});
	return selectMany<MailboxCursorRow>(env, 'mailbox_cursors', query);
}
