import { type WorkerEnv } from './lib/env';
import { json } from './lib/http';
import { requireInternalAuth } from './lib/auth';
import { handleBookingLink } from './routes/booking-link';
import { handleEmailInbound } from './routes/email-inbound';
import { handleHealth } from './routes/health';
import { handleTrackCTA } from './routes/track-cta';

export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
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
	}
};
