import type { Actions, PageServerLoad } from './$types';
import {
	duplicateCampaign,
	listCampaignsWithMetrics,
	setCampaignStatus
} from '$lib/server/campaigns/client';
import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { campaign_ad_groups, campaign_ad_packages, campaign_pages } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

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

		if (targetStatus === 'published') {
			let selectedCampaignPageId: number | null = null;

			const [latestAdPackage] = await db
				.select({ id: campaign_ad_packages.id })
				.from(campaign_ad_packages)
				.where(eq(campaign_ad_packages.campaign_id, id))
				.orderBy(desc(campaign_ad_packages.version_number))
				.limit(1);

			if (latestAdPackage) {
				const [adGroupWithPage] = await db
					.select({ campaignPageId: campaign_ad_groups.campaign_page_id })
					.from(campaign_ad_groups)
					.where(eq(campaign_ad_groups.ad_package_id, latestAdPackage.id))
					.limit(1);

				selectedCampaignPageId = adGroupWithPage?.campaignPageId ?? null;
			}

			if (!selectedCampaignPageId) {
				const [latestCampaignPage] = await db
					.select({ id: campaign_pages.id })
					.from(campaign_pages)
					.where(eq(campaign_pages.campaign_id, id))
					.orderBy(desc(campaign_pages.version_number))
					.limit(1);

				selectedCampaignPageId = latestCampaignPage?.id ?? null;
			}

			if (latestAdPackage && selectedCampaignPageId) {
				await db
					.update(campaign_ad_groups)
					.set({ campaign_page_id: selectedCampaignPageId, updated_at: new Date() })
					.where(eq(campaign_ad_groups.ad_package_id, latestAdPackage.id));
			}
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
