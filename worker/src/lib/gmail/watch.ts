import { requireEnv, type WorkerEnv } from '../env';
import { updateMany } from '../db';
import { gmailWatch } from './client';
import { listMailboxCursors } from './history-sync';

const DEFAULT_RENEWAL_BUFFER_SECONDS = 60 * 60 * 12;

type WatchRenewalOutcome = {
	gmail_user: string;
	ok: boolean;
	status: 'active' | 'renewal_failed';
	error?: string;
};

function resolveRenewalBufferSeconds(env: WorkerEnv): number {
	const raw = env.GMAIL_WATCH_RENEWAL_BUFFER_SECONDS;
	if (!raw) {
		return DEFAULT_RENEWAL_BUFFER_SECONDS;
	}
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_RENEWAL_BUFFER_SECONDS;
	}
	return Math.floor(parsed);
}

function parseOptionalLabelIds(value: string | undefined): string[] | undefined {
	if (!value) {
		return undefined;
	}
	const labels = value
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
	return labels.length > 0 ? labels : undefined;
}

async function markRenewalStatus(
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

export async function renewGmailWatches(env: WorkerEnv): Promise<WatchRenewalOutcome[]> {
	const now = Date.now();
	const nowIso = new Date(now).toISOString();
	const renewBeforeMs = now + resolveRenewalBufferSeconds(env) * 1000;
	const topicName = requireEnv(env, 'GMAIL_PUBSUB_TOPIC_NAME');
	const labelIds = parseOptionalLabelIds(env.GMAIL_WATCH_LABEL_IDS);
	const labelFilterAction = env.GMAIL_WATCH_LABEL_FILTER_ACTION;

	const cursors = await listMailboxCursors(env);
	const dueForRenewal = cursors.filter((cursor) => {
		const expirationMs = new Date(cursor.watch_expiration).getTime();
		if (!Number.isFinite(expirationMs) || expirationMs <= 0) {
			return true;
		}
		return expirationMs <= renewBeforeMs;
	});

	const outcomes: WatchRenewalOutcome[] = [];

	for (const cursor of dueForRenewal) {
		try {
			const watchResponse = await gmailWatch(env, {
				gmailUser: cursor.gmail_user,
				topicName,
				labelIds,
				labelFilterAction
			});

			const expirationMs = Number(watchResponse.expiration ?? 0);
			const watchExpiration =
				Number.isFinite(expirationMs) && expirationMs > 0
					? new Date(expirationMs).toISOString()
					: new Date(renewBeforeMs).toISOString();

			await markRenewalStatus(env, cursor.gmail_user, {
				watch_expiration: watchExpiration,
				last_watch_renewed_at: nowIso,
				sync_status: 'active',
				updated_at: nowIso
			});

			outcomes.push({
				gmail_user: cursor.gmail_user,
				ok: true,
				status: 'active'
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : 'unknown watch renewal error';
			await markRenewalStatus(env, cursor.gmail_user, {
				last_watch_renewed_at: nowIso,
				sync_status: 'renewal_failed',
				updated_at: nowIso
			});

			console.error('gmail_watch_renewal_failed', {
				gmail_user: cursor.gmail_user,
				error: message
			});

			outcomes.push({
				gmail_user: cursor.gmail_user,
				ok: false,
				status: 'renewal_failed',
				error: message
			});
		}
	}

	return outcomes;
}
