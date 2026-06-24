import { logCampaignVisit } from '$lib/server/attribution/campaign-visits';

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
): Promise<{ logged: boolean }> {
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
		return { logged: false };
	}
}
