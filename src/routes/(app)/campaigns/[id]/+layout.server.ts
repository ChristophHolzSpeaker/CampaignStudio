import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getCampaignById } from '$lib/server/campaigns/client';
import { campaign_pages } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';

export const load: LayoutServerLoad = async ({ params, url }) => {
	const campaignId = Number(params.id);

	if (!Number.isFinite(campaignId) || campaignId <= 0) {
		throw error(400, 'Invalid campaign id');
	}

	const campaign = await getCampaignById(campaignId);
	const [publishedCampaignPage] = await db
		.select({ id: campaign_pages.id, slug: campaign_pages.slug })
		.from(campaign_pages)
		.where(and(eq(campaign_pages.campaign_id, campaignId), eq(campaign_pages.is_published, true)))
		.orderBy(desc(campaign_pages.published_at), desc(campaign_pages.id))
		.limit(1);
	const liveLandingUrl = publishedCampaignPage?.slug
		? `${url.origin}/speaker/${publishedCampaignPage.slug}`
		: null;

	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	return { campaign, liveLandingUrl };
};
