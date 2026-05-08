import { z } from 'zod';
import { callOpenRouter } from '$lib/server/openrouter/client';

const intentDecisionSchema = z.object({
	decision: z.enum(['speaking_engagement', 'not_speaking_engagement', 'uncertain']),
	confidence: z.number().min(0).max(1),
	reason: z.string().trim().min(1).max(240)
});

export type LeadBookingIntentDecision = z.infer<typeof intentDecisionSchema>;

const INTENT_MODEL = 'google/gemini-3.1-flash-lite-preview';

export async function classifyLeadBookingIntent(input: {
	scope: string;
	company?: string | null;
	name?: string | null;
}): Promise<LeadBookingIntentDecision> {
	const systemPrompt = `You classify if a booking request is a true speaking engagement inquiry.
Return only JSON with fields: decision, confidence, reason.

Rules:
- decision must be one of: speaking_engagement, not_speaking_engagement, uncertain
- confidence must be a number between 0 and 1
- reason must be short and specific
- speaking_engagement means keynote, talk, workshop, panel, conference, event speaking invitation, or similar
- sales demo, support, hiring, partnership, press, generic chat, or unclear asks are not_speaking_engagement or uncertain`;

	const userPrompt = `Classify this request:\n${JSON.stringify(
		{
			scope: input.scope,
			company: input.company ?? null,
			name: input.name ?? null
		},
		null,
		2
	)}`;

	const raw = await callOpenRouter({
		model: INTENT_MODEL,
		systemPrompt,
		userPrompt,
		responseFormat: 'json_object'
	});

	return intentDecisionSchema.parse(raw);
}

export function isLeadBookingIntentApproved(input: LeadBookingIntentDecision): boolean {
	return input.decision === 'speaking_engagement' && input.confidence >= 0.7;
}
