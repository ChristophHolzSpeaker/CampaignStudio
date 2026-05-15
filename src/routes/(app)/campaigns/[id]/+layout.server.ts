import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getCampaignById } from '$lib/server/campaigns/client';

export const load: LayoutServerLoad = async ({ params }) => {
	const campaignId = Number(params.id);

	if (!Number.isFinite(campaignId) || campaignId <= 0) {
		throw error(400, 'Invalid campaign id');
	}

	const campaign = await getCampaignById(campaignId);

	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	return { campaign };
};
