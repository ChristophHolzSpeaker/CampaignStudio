import type { CampaignRecord } from '$lib/server/campaigns/client';
import { campaignBriefSchema } from './schemas/campaign-brief';

export function normalizeCampaignBrief(campaign: CampaignRecord) {
	return campaignBriefSchema.parse({
		campaignId: campaign.id,
		name: campaign.name,
		audience: campaign.audience,
		format: campaign.format,
		topic: campaign.topic,
		language: campaign.language,
		geography: campaign.geography,
		notes: campaign.notes ?? null,
		goal: 'speaker_inquiry'
	});
}
