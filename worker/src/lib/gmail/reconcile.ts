import type { WorkerEnv } from '../env';
import { listMailboxCursors, syncMailboxHistory, type MailboxCursorRow } from './history-sync';
import { activateMailboxWatch } from './watch';

const DEFAULT_PUSH_STALE_SECONDS = 60 * 60 * 6;
const DEFAULT_SYNC_STALE_SECONDS = 60 * 60 * 2;
const DEFAULT_RETRY_COOLDOWN_SECONDS = 60 * 15;

export type MailboxReconcileOutcome = {
	gmail_user: string;
	status:
		| 'healthy'
		| 'sync_attempted'
		| 'sync_failed'
		| 'resync_required'
		| 'recovered'
		| 'retry_scheduled';
	reason: string;
	sync_status: string;
	processed_messages?: number;
	error?: string;
};

function parseOptionalTimestampMs(value: string | null): number | null {
	if (!value) {
		return null;
	}
	const parsed = new Date(value).getTime();
	return Number.isFinite(parsed) ? parsed : null;
}

function resolveSeconds(
	value: string | undefined,
	fallback: number,
	options?: { allowZero?: boolean }
): number {
	if (!value) {
		return fallback;
	}
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return fallback;
	}
	if (options?.allowZero && parsed === 0) {
		return 0;
	}
	if (parsed <= 0) {
		return fallback;
	}
	return Math.floor(parsed);
}

function shouldRetryFailedSync(
	nowMs: number,
	lastSyncMs: number | null,
	retryCooldownMs: number
): boolean {
	if (lastSyncMs === null) {
		return true;
	}
	if (retryCooldownMs === 0) {
		return true;
	}
	return nowMs - lastSyncMs >= retryCooldownMs;
}

async function attemptSync(
	env: WorkerEnv,
	cursor: MailboxCursorRow
): Promise<MailboxReconcileOutcome> {
	const result = await syncMailboxHistory(env, { gmailUser: cursor.gmail_user });

	if (result.status === 'active') {
		return {
			gmail_user: cursor.gmail_user,
			status: 'sync_attempted',
			reason: 'reconciled_successfully',
			sync_status: result.status,
			processed_messages: result.processed_messages
		};
	}

	if (result.status === 'resync_required') {
		return recoverStaleCursor(env, cursor);
	}

	return {
		gmail_user: cursor.gmail_user,
		status: 'sync_failed',
		reason: 'sync_execution_failed',
		sync_status: result.status,
		processed_messages: result.processed_messages
	};
}

async function recoverStaleCursor(
	env: WorkerEnv,
	cursor: MailboxCursorRow
): Promise<MailboxReconcileOutcome> {
	const recovery = await activateMailboxWatch(env, { gmailUser: cursor.gmail_user });
	if (!recovery.ok) {
		return {
			gmail_user: cursor.gmail_user,
			status: 'resync_required',
			reason: 'stale_cursor_recovery_failed',
			sync_status: 'resync_required',
			error: recovery.error
		};
	}

	return {
		gmail_user: cursor.gmail_user,
		status: 'recovered',
		reason: 'stale_cursor_backfilled',
		sync_status: 'active',
		processed_messages: recovery.processed_messages ?? 0
	};
}

export async function reconcileMailboxHealth(env: WorkerEnv): Promise<MailboxReconcileOutcome[]> {
	const nowMs = Date.now();
	const pushStaleMs =
		resolveSeconds(env.GMAIL_RECONCILE_PUSH_STALE_SECONDS, DEFAULT_PUSH_STALE_SECONDS) * 1000;
	const syncStaleMs =
		resolveSeconds(env.GMAIL_RECONCILE_SYNC_STALE_SECONDS, DEFAULT_SYNC_STALE_SECONDS) * 1000;
	const retryCooldownMs =
		resolveSeconds(env.GMAIL_RECONCILE_RETRY_COOLDOWN_SECONDS, DEFAULT_RETRY_COOLDOWN_SECONDS, {
			allowZero: true
		}) * 1000;

	const cursors = await listMailboxCursors(env);
	const outcomes: MailboxReconcileOutcome[] = [];

	for (const cursor of cursors) {
		const lastPushMs = parseOptionalTimestampMs(cursor.last_push_received_at);
		const lastSyncMs = parseOptionalTimestampMs(cursor.last_sync_at);
		const missingPush = lastPushMs === null || nowMs - lastPushMs >= pushStaleMs;
		const syncStale = lastSyncMs === null || nowMs - lastSyncMs >= syncStaleMs;

		if (cursor.sync_status === 'resync_required') {
			try {
				outcomes.push(await recoverStaleCursor(env, cursor));
			} catch (error) {
				outcomes.push({
					gmail_user: cursor.gmail_user,
					status: 'resync_required',
					reason: 'stale_cursor_recovery_unhandled_error',
					sync_status: cursor.sync_status,
					error: error instanceof Error ? error.message : 'unknown'
				});
			}
			continue;
		}

		if (cursor.sync_status === 'sync_failed') {
			if (!shouldRetryFailedSync(nowMs, lastSyncMs, retryCooldownMs)) {
				outcomes.push({
					gmail_user: cursor.gmail_user,
					status: 'retry_scheduled',
					reason: 'sync_failed_retry_cooldown',
					sync_status: cursor.sync_status
				});
				continue;
			}

			try {
				outcomes.push(await attemptSync(env, cursor));
			} catch (error) {
				outcomes.push({
					gmail_user: cursor.gmail_user,
					status: 'sync_failed',
					reason: 'sync_retry_unhandled_error',
					sync_status: 'sync_failed',
					error: error instanceof Error ? error.message : 'unknown'
				});
			}
			continue;
		}

		if (missingPush || syncStale) {
			try {
				const outcome = await attemptSync(env, cursor);
				outcomes.push({
					...outcome,
					reason: missingPush
						? 'missing_push_detected'
						: syncStale
							? 'sync_stale_detected'
							: outcome.reason
				});
			} catch (error) {
				outcomes.push({
					gmail_user: cursor.gmail_user,
					status: 'sync_failed',
					reason: 'reconcile_sync_unhandled_error',
					sync_status: 'sync_failed',
					error: error instanceof Error ? error.message : 'unknown'
				});
			}
			continue;
		}

		outcomes.push({
			gmail_user: cursor.gmail_user,
			status: 'healthy',
			reason: 'recent_push_and_sync_present',
			sync_status: cursor.sync_status
		});
	}

	return outcomes;
}
