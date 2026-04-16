import { requireEnv, type WorkerEnv } from '../env';
import { updateMany, upsertOne } from '../db';
import { gmailWatch } from './client';
import { listMailboxCursors } from './history-sync';

const DEFAULT_RENEWAL_BUFFER_SECONDS = 60 * 60 * 12;

type WatchRenewalOutcome = {
	gmail_user: string;
	ok: boolean;
	status: 'active' | 'renewal_failed';
	error?: string;
};

export type WatchActivationOutcome = {
	gmail_user: string;
	ok: boolean;
	status: 'active' | 'activation_failed';
	history_id?: string;
	watch_expiration?: string;
	error?: string;
};

function resolveWatchTopicName(env: WorkerEnv): string {
	if (env.GOOGLE_WATCH_TOPIC && env.GOOGLE_WATCH_TOPIC.trim().length > 0) {
		return env.GOOGLE_WATCH_TOPIC.trim();
	}
	return requireEnv(env, 'GMAIL_PUBSUB_TOPIC_NAME');
}

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

function resolveLabelFilterBehavior(env: WorkerEnv): 'INCLUDE' | 'EXCLUDE' | undefined {
	const action = env.GMAIL_WATCH_LABEL_FILTER_ACTION;
	if (!action) {
		return undefined;
	}
	return action === 'include' ? 'INCLUDE' : 'EXCLUDE';
}

function resolveWatchExpirationIso(
	expiration: string | undefined,
	fallbackMs: number,
	nowMs: number
): string {
	const expirationMs = Number(expiration ?? 0);
	if (Number.isFinite(expirationMs) && expirationMs > 0) {
		return new Date(expirationMs).toISOString();
	}
	return new Date(nowMs + fallbackMs).toISOString();
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
	const renewalBufferMs = resolveRenewalBufferSeconds(env) * 1000;
	const renewBeforeMs = now + renewalBufferMs;
	const topicName = resolveWatchTopicName(env);
	const labelIds = parseOptionalLabelIds(env.GMAIL_WATCH_LABEL_IDS);
	const labelFilterBehavior = resolveLabelFilterBehavior(env);

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
				labelFilterBehavior
			});

			const watchExpiration = resolveWatchExpirationIso(
				watchResponse.expiration,
				renewalBufferMs,
				now
			);

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

export async function activateMailboxWatch(
	env: WorkerEnv,
	params: {
		gmailUser: string;
	}
): Promise<WatchActivationOutcome> {
	const now = Date.now();
	const nowIso = new Date(now).toISOString();
	const renewalBufferMs = resolveRenewalBufferSeconds(env) * 1000;
	const topicName = resolveWatchTopicName(env);
	const labelIds = parseOptionalLabelIds(env.GMAIL_WATCH_LABEL_IDS);
	const labelFilterBehavior = resolveLabelFilterBehavior(env);

	try {
		const watchResponse = await gmailWatch(env, {
			gmailUser: params.gmailUser,
			topicName,
			labelIds,
			labelFilterBehavior
		});

		if (!watchResponse.historyId || watchResponse.historyId.trim().length === 0) {
			throw new Error('Watch activation missing historyId');
		}

		const watchExpiration = resolveWatchExpirationIso(
			watchResponse.expiration,
			renewalBufferMs,
			now
		);

		await upsertOne(
			env,
			'mailbox_cursors',
			{
				gmail_user: params.gmailUser,
				last_processed_history_id: watchResponse.historyId,
				watch_expiration: watchExpiration,
				last_watch_renewed_at: nowIso,
				sync_status: 'active',
				updated_at: nowIso
			},
			{
				onConflict: 'gmail_user'
			}
		);

		console.log('gmail_watch_activated', {
			gmail_user: params.gmailUser,
			topic_name: topicName,
			history_id: watchResponse.historyId,
			watch_expiration: watchExpiration
		});

		return {
			gmail_user: params.gmailUser,
			ok: true,
			status: 'active',
			history_id: watchResponse.historyId,
			watch_expiration: watchExpiration
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'unknown watch activation error';
		console.error('gmail_watch_activation_failed', {
			gmail_user: params.gmailUser,
			error: message
		});
		return {
			gmail_user: params.gmailUser,
			ok: false,
			status: 'activation_failed',
			error: message
		};
	}
}
