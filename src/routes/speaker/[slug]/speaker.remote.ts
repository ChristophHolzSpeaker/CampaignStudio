import { command, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { logSpeakerVisitFromRequest } from './speaker-visit';

const speakerVisitSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	slug: z.string().min(1),
	visitorIdentifier: z.string().min(1),
	searchParams: z.record(z.string(), z.string())
});

export const logSpeakerVisit = command(speakerVisitSchema, async (input) => {
	const requestEvent = getRequestEvent();
	return logSpeakerVisitFromRequest(input, requestEvent.request.headers);
});
