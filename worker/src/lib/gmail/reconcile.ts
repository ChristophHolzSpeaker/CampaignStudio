import type { WorkerEnv } from '../env';
import { listMailboxCursors, syncMailboxHistory, type MailboxCursorRow } from './history-sync';

const DEFAULT_PUSH_STALE_SECONDS = 60 * 60 * 6;
const DEFAULT_SYNC_STALE_SECONDS = 60 * 60 * 2;
const DEFAULT_RETRY_COOLDOWN_SECONDS = 60 * 15;

export type MailboxReconcileOutcome = {
	gmail_user: string;
	status: 'healthy' | 'sync_attempted' | 'sync_failed' | 'resync_required' | 'retry_scheduled';
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
		return {
			gmail_user: cursor.gmail_user,
			status: 'resync_required',
			reason: 'history_cursor_invalid_or_stale',
			sync_status: result.status,
			processed_messages: result.processed_messages
		};
	}

	return {
		gmail_user: cursor.gmail_user,
		status: 'sync_failed',
		reason: 'sync_execution_failed',
		sync_status: result.status,
		processed_messages: result.processed_messages
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
			outcomes.push({
				gmail_user: cursor.gmail_user,
				status: 'resync_required',
				reason: 'cursor_marked_resync_required',
				sync_status: cursor.sync_status
			});
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
