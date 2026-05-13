import { z } from 'zod';
import { badRequestFromZod, json } from '../lib/http';
import type { WorkerEnv } from '../lib/env';
import { requireEnv } from '../lib/env';
import { sendOutboundEmail } from '../lib/gmail/send';
import type {
	FormSubmissionNotificationRequest,
	FormSubmissionNotificationResponse
} from '../../../shared/form-submission-notifications';

const formSubmissionNotificationSchema = z.object({
	to_email: z.string().trim().email(),
	subject: z.string().trim().min(1).max(255),
	body_text: z.string().trim().min(1).max(20000),
	metadata: z.record(z.string(), z.unknown()).optional()
});

export async function handleFormSubmissionNotification(
	request: Request,
	env: WorkerEnv
): Promise<Response> {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON payload' }, 400);
	}

	const parsed = formSubmissionNotificationSchema.safeParse(payload);
	if (!parsed.success) {
		return badRequestFromZod(parsed.error);
	}

	const input: FormSubmissionNotificationRequest = parsed.data;

	try {
		const result = await sendOutboundEmail(env, {
			gmailUser: requireEnv(env, 'GOOGLE_IMPERSONATED_USER'),
			to: [input.to_email],
			subject: input.subject,
			bodyText: input.body_text,
			autoResponseDecision: null,
			rawMetadata: {
				form_submission_notification: {
					metadata: input.metadata ?? null
				}
			}
		});

		const response: FormSubmissionNotificationResponse = {
			ok: true,
			provider_message_id: result.provider_message_id,
			provider_thread_id: result.provider_thread_id
		};

		return json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Form submission email send failed';
		return json({ ok: false, error: message }, 502);
	}
}
