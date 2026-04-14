import { db } from '$lib/server/db';
import { campaign_pages } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export async function resolveCampaignPageContext(input: {
	campaignId: number;
	campaignPageId: number;
}): Promise<{ campaignId: number; campaignPageId: number } | null> {
	const [record] = await db
		.select({
			campaignId: campaign_pages.campaign_id,
			campaignPageId: campaign_pages.id
		})
		.from(campaign_pages)
		.where(
			and(
				eq(campaign_pages.id, input.campaignPageId),
				eq(campaign_pages.campaign_id, input.campaignId)
			)
		)
		.limit(1);

	if (!record) {
		return null;
	}

	return {
		campaignId: record.campaignId,
		campaignPageId: record.campaignPageId
	};
}
