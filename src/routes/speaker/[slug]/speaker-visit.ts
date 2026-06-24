import {
	logCampaignVisit,
	markCampaignVisitEngaged
} from '$lib/server/attribution/campaign-visits';

export type SpeakerVisitInput = {
	campaignId: number;
	campaignPageId: number;
	slug: string;
	visitorIdentifier: string;
	searchParams: Record<string, string>;
};

export async function logSpeakerVisitFromRequest(
	input: SpeakerVisitInput,
	headers: Headers
): Promise<{ logged: boolean; visitId: number | null }> {
	try {
		const result = await logCampaignVisit({
			campaignId: input.campaignId,
			campaignPageId: input.campaignPageId,
			slug: input.slug,
			searchParams: new URLSearchParams(input.searchParams),
			headers,
			visitorIdentifier: input.visitorIdentifier
		});

		return result;
	} catch (error) {
		console.error('Speaker visit logging failed', error);
		return { logged: false, visitId: null };
	}
}

export async function markSpeakerVisitEngagedFromRequest(input: {
	visitId: number;
	visitorIdentifier: string;
	durationMs: number;
}): Promise<{ marked: boolean }> {
	try {
		return await markCampaignVisitEngaged(input);
	} catch (error) {
		console.error('Speaker visit engagement logging failed', error);
		return { marked: false };
	}
}
