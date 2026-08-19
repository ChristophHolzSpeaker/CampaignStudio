import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type {
	CampaignAdGroupWithDetails,
	CampaignAdPackageWithDetails
} from '$lib/server/campaigns/client';
import {
	duplicateCampaign,
	getCampaignAdPackageWithDetails,
	getCampaignAdPackages,
	getCampaignById,
	getCampaignVisitMetricsByCampaignId
} from '$lib/server/campaigns/client';
import type { Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { campaign_pages } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { runCampaignRegenerationFromStrategyPrompt } from '$lib/server/agents/google-ads-pipeline';
import { buildLivePageUrl } from '$lib/page-url';

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
	const campaignPages = await db
		.select({
			id: campaign_pages.id,
			versionNumber: campaign_pages.version_number,
			rendererType: campaign_pages.renderer_type,
			slug: campaign_pages.slug,
			isPublished: campaign_pages.is_published,
			publishedAt: campaign_pages.published_at,
			createdAt: campaign_pages.created_at,
			changeNote: campaign_pages.change_note
		})
		.from(campaign_pages)
		.where(eq(campaign_pages.campaign_id, candidateId))
		.orderBy(desc(campaign_pages.version_number), desc(campaign_pages.id));

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
	const publishedCampaignPage = campaignPages.find((page) => page.isPublished);

	const liveLandingUrl = publishedCampaignPage?.slug
		? buildLivePageUrl(url.origin, publishedCampaignPage.slug, publishedCampaignPage.rendererType)
		: null;

	if (campaignPageId) {
		const selectedCampaignPage = campaignPages.find((page) => page.id === campaignPageId);

		campaignPageId = selectedCampaignPage?.id ?? campaignPageId;
		campaignPageSlug = selectedCampaignPage?.slug ?? null;
	}

	if (!campaignPageSlug) {
		const latestCampaignPage = campaignPages[0];

		campaignPageId = latestCampaignPage?.id ?? null;
		campaignPageSlug = latestCampaignPage?.slug ?? null;
	}

	return {
		campaign,
		visitMetrics,
		adGroups,
		adPackage,
		campaignPageId,
		campaignPages: campaignPages.map((page) => ({
			...page,
			previewUrl: `/campaigns/${candidateId}/landing-page?version=${page.id}`,
			liveUrl: page.isPublished ? buildLivePageUrl(url.origin, page.slug, page.rendererType) : null
		})),
		liveLandingUrl
	};
};

export const actions: Actions = {
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
	},
	duplicate: async ({ request, params, locals }) => {
		const sourceCampaignId = Number(params.id);
		const formData = await request.formData();
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
