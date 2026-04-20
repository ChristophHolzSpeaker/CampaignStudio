import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type {
	CampaignAdGroupWithDetails,
	CampaignAdPackageWithDetails
} from '$lib/server/campaigns/client';
import {
	getCampaignAdPackageWithDetails,
	getCampaignAdPackages,
	getCampaignById,
	getCampaignVisitMetricsByCampaignId
} from '$lib/server/campaigns/client';
import { setCampaignStatus } from '$lib/server/campaigns/client';
import type { Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { campaign_pages } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { runCampaignRegenerationFromStrategyPrompt } from '$lib/server/agents/google-ads-pipeline';

type StrategyUpdateFormState = {
	values: {
		strategyPrompt: string;
	};
	message?: string;
	success?: boolean;
	adPackageId?: number;
	campaignPageId?: number;
};

export type CampaignDetailActionData = {
	strategyUpdate?: StrategyUpdateFormState;
};

export const load: PageServerLoad = async ({ params, url }) => {
	const candidateId = Number(params.id);

	if (!Number.isFinite(candidateId) || candidateId <= 0) {
		throw error(400, 'Invalid campaign id');
	}

	const campaign = await getCampaignById(candidateId);

	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	const visitMetrics = await getCampaignVisitMetricsByCampaignId(candidateId);

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

	const adGroupPageId = adGroups.find((group) => group.campaign_page_id)?.campaign_page_id ?? null;
	let campaignPageId = adGroupPageId;
	let campaignPageSlug: string | null = null;

	if (campaignPageId) {
		const [selectedCampaignPage] = await db
			.select({ id: campaign_pages.id, slug: campaign_pages.slug })
			.from(campaign_pages)
			.where(eq(campaign_pages.id, campaignPageId))
			.limit(1);

		campaignPageId = selectedCampaignPage?.id ?? campaignPageId;
		campaignPageSlug = selectedCampaignPage?.slug ?? null;
	}

	if (!campaignPageSlug) {
		const [latestCampaignPage] = await db
			.select({ id: campaign_pages.id, slug: campaign_pages.slug })
			.from(campaign_pages)
			.where(eq(campaign_pages.campaign_id, candidateId))
			.orderBy(desc(campaign_pages.version_number))
			.limit(1);

		campaignPageId = latestCampaignPage?.id ?? null;
		campaignPageSlug = latestCampaignPage?.slug ?? null;
	}

	const liveLandingUrl = campaignPageSlug ? `${url.origin}/speaker/${campaignPageSlug}` : null;

	return {
		campaign,
		visitMetrics,
		adGroups,
		adPackage,
		campaignPageId,
		liveLandingUrl
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
	},
	updateStrategy: async ({ request, params }) => {
		const formData = await request.formData();
		const id = Number(params.id);
		const strategyPrompt = formData.get('strategy_prompt')?.toString().trim() ?? '';

		if (!Number.isFinite(id) || id <= 0) {
			return fail<CampaignDetailActionData>(400, {
				strategyUpdate: {
					values: { strategyPrompt },
					message: 'Invalid campaign id.',
					success: false
				}
			});
		}

		if (!strategyPrompt.length) {
			return fail<CampaignDetailActionData>(400, {
				strategyUpdate: {
					values: { strategyPrompt },
					message: 'Please describe how the campaign strategy should change.',
					success: false
				}
			});
		}

		try {
			const result = await runCampaignRegenerationFromStrategyPrompt(id, strategyPrompt);

			return {
				strategyUpdate: {
					values: { strategyPrompt: '' },
					message: 'Strategy updated. Ads and landing page were regenerated.',
					success: true,
					adPackageId: result.adPackageId,
					campaignPageId: result.campaignPageId
				}
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return fail<CampaignDetailActionData>(500, {
				strategyUpdate: {
					values: { strategyPrompt },
					message: `Strategy update failed: ${message}`,
					success: false
				}
			});
		}
	}
};
