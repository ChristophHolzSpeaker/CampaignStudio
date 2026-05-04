import type { Actions, PageServerLoad } from './$types';
import {
	duplicateCampaign,
	listCampaignsWithMetrics,
	setCampaignStatus
} from '$lib/server/campaigns/client';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const campaignList = await listCampaignsWithMetrics();
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
	},
	duplicate: async ({ request, locals }) => {
		const formData = await request.formData();
		const sourceCampaignId = Number(formData.get('id'));
		const name = formData.get('duplicate_name')?.toString().trim() ?? '';

		if (!Number.isFinite(sourceCampaignId) || sourceCampaignId <= 0) {
			return fail(400, { success: false, message: 'Invalid campaign selected for duplication.' });
		}

		if (!name.length) {
			return fail(400, {
				success: false,
				message: 'Please provide a name for the duplicated campaign.'
			});
		}

		const { data: userData } = await locals.supabase.auth.getUser();
		const createdBy = userData?.user?.id ?? null;
		const duplicated = await duplicateCampaign({
			sourceCampaignId,
			name,
			createdBy
		});

		throw redirect(303, `/campaigns/${duplicated.campaignId}`);
	}
};
