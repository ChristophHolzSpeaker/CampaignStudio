import { type WorkerEnv, type WorkerExecutionContext, type WorkerScheduledEvent } from './lib/env';
import { json } from './lib/http';
import { requireInternalAuth } from './lib/auth';
import { handleBookingLink } from './routes/booking-link';
import { handleEmailInbound } from './routes/email-inbound';
import { renewGmailWatches } from './lib/gmail/watch';
import { handleGmailPush } from './routes/gmail-push';
import { handleHealth } from './routes/health';
import { handleTrackCTA } from './routes/track-cta';

export default {
	async fetch(request: Request, env: WorkerEnv, ctx: WorkerExecutionContext): Promise<Response> {
		const { pathname } = new URL(request.url);

		try {
			if (pathname === '/health' && request.method === 'GET') {
				return handleHealth();
			}

			if (pathname === '/track/cta' && request.method === 'GET') {
				if (!requireInternalAuth(request, env)) {
					return json({ ok: false, error: 'Unauthorized' }, 401);
				}
				return await handleTrackCTA(request, env);
			}

			if (pathname === '/email/inbound' && request.method === 'POST') {
				return await handleEmailInbound(request, env);
			}

			if (pathname === '/gmail/push' && request.method === 'POST') {
				return await handleGmailPush(request, env, ctx);
			}

			if (pathname === '/booking/link' && request.method === 'POST') {
				if (!requireInternalAuth(request, env)) {
					return json({ ok: false, error: 'Unauthorized' }, 401);
				}
				return await handleBookingLink(request, env);
			}

			return json({ ok: false, error: 'Not found' }, 404);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unexpected error';
			return json({ ok: false, error: message }, 500);
		}
	},
	async scheduled(
		event: WorkerScheduledEvent,
		env: WorkerEnv,
		ctx: WorkerExecutionContext
	): Promise<void> {
		ctx.waitUntil(
			renewGmailWatches(env)
				.then((result) => {
					console.log('gmail_watch_renewal_complete', {
						cron: event.cron,
						scheduled_time: event.scheduledTime,
						renewed_count: result.filter((entry) => entry.ok).length,
						failed_count: result.filter((entry) => !entry.ok).length
					});
				})
				.catch((error) => {
					console.error('gmail_watch_renewal_unhandled_error', {
						cron: event.cron,
						error: error instanceof Error ? error.message : 'unknown'
					});
				})
		);
	}
};
