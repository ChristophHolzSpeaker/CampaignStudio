import type { WorkerEnv, WorkerExecutionContext } from '../env';
import { GoogleAuthError } from '../google-auth/errors';
import { syncMailboxHistory } from './history-sync';

export type MailboxSyncTriggerResult = {
	status: 'queued';
};

export function triggerMailboxSync(
	env: WorkerEnv,
	ctx: WorkerExecutionContext,
	params: {
		gmailUser: string;
		historyId?: string | null;
	}
): MailboxSyncTriggerResult {
	ctx.waitUntil(
		syncMailboxHistory(env, {
			gmailUser: params.gmailUser,
			hintedHistoryId: params.historyId
		})
			.then((result) => {
				console.log('gmail_push_sync_complete', {
					gmail_user: params.gmailUser,
					status: result.status,
					processed_messages: result.processed_messages,
					last_history_id: result.last_history_id
				});
			})
			.catch((error) => {
				const authDetails =
					error instanceof GoogleAuthError
						? {
								error_code: error.code,
								google_status:
									typeof error.details?.status === 'number' ? error.details.status : undefined,
								google_response: error.details?.response
							}
						: {};

				console.error('gmail_push_sync_unhandled_error', {
					gmail_user: params.gmailUser,
					error: error instanceof Error ? error.message : 'unknown',
					...authDetails
				});
			})
	);

	return { status: 'queued' };
}
