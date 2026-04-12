import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type {
	CampaignAdGroupWithDetails,
	CampaignAdPackageWithDetails
} from '$lib/server/campaigns/client';
import {
	getCampaignAdPackageWithDetails,
	getCampaignAdPackages,
	getCampaignById
} from '$lib/server/campaigns/client';
import { setCampaignStatus } from '$lib/server/campaigns/client';
import type { Actions } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const candidateId = Number(params.id);

	if (!Number.isFinite(candidateId) || candidateId <= 0) {
		throw error(400, 'Invalid campaign id');
	}

	const campaign = await getCampaignById(candidateId);

	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	const adPackages = await getCampaignAdPackages(candidateId);
	const latestPackage = adPackages.at(-1);
	let adGroups: CampaignAdGroupWithDetails[] = [];
	let adPackage: CampaignAdPackageWithDetails | null = null;

	if (latestPackage) {
		const details = await getCampaignAdPackageWithDetails(latestPackage.id);

		if (details) {
			adGroups = details.groups;
			adPackage = details;
		}
	}

	return {
		campaign,
		adGroups,
		adPackage
	};
};

export const actions: Actions = {
	publish: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const targetStatus = formData.get('target_status')?.toString() ?? 'draft';
		console.log('publishing campaign', { id, targetStatus });
		if (!id) {
			return { success: false };
		}

		await setCampaignStatus(id, targetStatus);

		return { success: true };
	}
};
