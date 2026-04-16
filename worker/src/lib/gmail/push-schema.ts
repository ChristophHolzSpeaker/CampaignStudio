import { z } from 'zod';

export const pubSubPushEnvelopeSchema = z.object({
	subscription: z.string().trim().min(1),
	message: z.object({
		data: z.string().trim().min(1),
		messageId: z.string().trim().min(1),
		publishTime: z.string().trim().min(1).optional(),
		attributes: z.record(z.string(), z.string()).optional()
	})
});

export const gmailPushPayloadSchema = z.object({
	emailAddress: z.string().trim().email().optional(),
	historyId: z
		.preprocess((value) => {
			if (typeof value === 'string' || typeof value === 'number') {
				return String(value);
			}
			return value;
		}, z.string().trim().min(1))
		.optional()
});

export type PubSubPushEnvelope = z.infer<typeof pubSubPushEnvelopeSchema>;
export type GmailPushPayload = z.infer<typeof gmailPushPayloadSchema>;
