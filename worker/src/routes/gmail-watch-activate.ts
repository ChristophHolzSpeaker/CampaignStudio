import { z } from 'zod';
import type { WorkerEnv } from '../lib/env';
import { badRequestFromZod, json } from '../lib/http';
import { activateMailboxWatch } from '../lib/gmail/watch';

const activateWatchSchema = z.object({
	gmail_user: z.string().trim().email()
});

export async function handleGmailWatchActivate(
	request: Request,
	env: WorkerEnv
): Promise<Response> {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const parsed = activateWatchSchema.safeParse(payload);
	if (!parsed.success) {
		return badRequestFromZod(parsed.error);
	}

	const activation = await activateMailboxWatch(env, {
		gmailUser: parsed.data.gmail_user
	});

	if (!activation.ok) {
		return json(
			{
				ok: false,
				error: 'Watch activation failed',
				details: activation
			},
			500
		);
	}

	return json({
		ok: true,
		gmail_user: activation.gmail_user,
		history_id: activation.history_id,
		watch_expiration: activation.watch_expiration
	});
}
