import { type WorkerEnv, type WorkerExecutionContext, type WorkerScheduledEvent } from './lib/env';
import { json } from './lib/http';
import { requireInternalAuth } from './lib/auth';
import { handleBookingLink } from './routes/booking-link';
import { handleEmailInbound } from './routes/email-inbound';
import { renewGmailWatches } from './lib/gmail/watch';
import { reconcileMailboxHealth } from './lib/gmail/reconcile';
import { handleGmailPush } from './routes/gmail-push';
import { handleGmailWatchActivate } from './routes/gmail-watch-activate';
import { handleHealth } from './routes/health';
import { handleTrackCTA } from './routes/track-cta';
import { handleBookingCalendarEvent } from './routes/booking-calendar-event';
import { handleBookingCalendarEventUpdate } from './routes/booking-calendar-event-update';

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

			if (pathname === '/gmail/push') {
				if (request.method !== 'POST') {
					return json({ ok: false, error: 'Method not allowed' }, 405);
				}
				return await handleGmailPush(request, env, ctx);
			}

			if (pathname === '/gmail/watch/activate' && request.method === 'POST') {
				if (!requireInternalAuth(request, env)) {
					return json({ ok: false, error: 'Unauthorized' }, 401);
				}
				return await handleGmailWatchActivate(request, env);
			}

			if (pathname === '/booking/link' && request.method === 'POST') {
				if (!requireInternalAuth(request, env)) {
					return json({ ok: false, error: 'Unauthorized' }, 401);
				}
				return await handleBookingLink(request, env);
			}

			if (pathname === '/booking/calendar-event' && request.method === 'POST') {
				if (!requireInternalAuth(request, env)) {
					return json({ ok: false, error: 'Unauthorized' }, 401);
				}
				return await handleBookingCalendarEvent(request, env);
			}

			if (pathname === '/booking/calendar-event/update' && request.method === 'POST') {
				if (!requireInternalAuth(request, env)) {
					return json({ ok: false, error: 'Unauthorized' }, 401);
				}
				return await handleBookingCalendarEventUpdate(request, env);
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
			Promise.allSettled([renewGmailWatches(env), reconcileMailboxHealth(env)]).then((results) => {
				const watchResult = results[0];
				if (watchResult?.status === 'fulfilled') {
					console.log('gmail_watch_renewal_complete', {
						cron: event.cron,
						scheduled_time: event.scheduledTime,
						renewed_count: watchResult.value.filter((entry) => entry.ok).length,
						failed_count: watchResult.value.filter((entry) => !entry.ok).length
					});
				} else {
					console.error('gmail_watch_renewal_unhandled_error', {
						cron: event.cron,
						error: watchResult?.reason instanceof Error ? watchResult.reason.message : 'unknown'
					});
				}

				const reconcileResult = results[1];
				if (reconcileResult?.status === 'fulfilled') {
					const outcomes = reconcileResult.value;
					console.log('gmail_mailbox_reconcile_complete', {
						cron: event.cron,
						scheduled_time: event.scheduledTime,
						healthy_count: outcomes.filter((item) => item.status === 'healthy').length,
						sync_attempted_count: outcomes.filter((item) => item.status === 'sync_attempted')
							.length,
						failed_count: outcomes.filter(
							(item) => item.status === 'sync_failed' || item.status === 'resync_required'
						).length
					});
				} else {
					console.error('gmail_mailbox_reconcile_unhandled_error', {
						cron: event.cron,
						error:
							reconcileResult?.reason instanceof Error ? reconcileResult.reason.message : 'unknown'
					});
				}
			})
		);
	}
};
