import { z } from 'zod';
import type { WorkerEnv } from '../lib/env';
import { badRequestFromZod, json } from '../lib/http';
import { gmailStop } from '../lib/gmail/client';

const stopWatchSchema = z.object({
	gmail_user: z.string().trim().email()
});

export async function handleGmailWatchStop(request: Request, env: WorkerEnv): Promise<Response> {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const parsed = stopWatchSchema.safeParse(payload);
	if (!parsed.success) {
		return badRequestFromZod(parsed.error);
	}

	await gmailStop(env, {
		gmailUser: parsed.data.gmail_user
	});

	return json({
		ok: true,
		gmail_user: parsed.data.gmail_user,
		status: 'stopped'
	});
}
