import type { Actions, PageServerLoad } from './$types';
import { listCampaigns, setCampaignStatus } from '$lib/server/campaigns/client';

export const load: PageServerLoad = async () => {
	const campaignList = await listCampaigns();
	return {
		campaignList
	};
};

export const actions: Actions = {
	publish: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const targetStatus = formData.get('target_status')?.toString() ?? 'draft';

		if (!id) {
			return { success: false };
		}

		await setCampaignStatus(id, targetStatus);
		return { success: true };
	}
};
