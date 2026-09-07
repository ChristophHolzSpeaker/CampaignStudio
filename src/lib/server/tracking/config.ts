import { db } from '$lib/server/db';
import { campaign_tracking } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { trackingConfigSchema } from '$lib/tracking/contract';
export async function getTrackingConfig(campaignId: number) {
	const [row] = await db
		.select()
		.from(campaign_tracking)
		.where(eq(campaign_tracking.campaign_id, campaignId))
		.limit(1);
	return trackingConfigSchema.parse(row?.config ?? {});
}
