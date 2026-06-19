import { command, getRequestEvent } from '$app/server';
import { logCampaignVisit } from '$lib/server/attribution/campaign-visits';
import { z } from 'zod';

const speakerVisitSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	slug: z.string().min(1),
	visitorIdentifier: z.string().min(1),
	searchParams: z.record(z.string(), z.string())
});

export const logSpeakerVisit = command(speakerVisitSchema, async (input) => {
	const requestEvent = getRequestEvent();

	try {
		const result = await logCampaignVisit({
			campaignId: input.campaignId,
			campaignPageId: input.campaignPageId,
			slug: input.slug,
			searchParams: new URLSearchParams(input.searchParams),
			headers: requestEvent.request.headers,
			visitorIdentifier: input.visitorIdentifier
		});

		return result;
	} catch (error) {
		console.error('Speaker visit logging failed', error);
		return { logged: false };
	}
});
