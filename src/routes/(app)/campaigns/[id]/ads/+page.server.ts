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
import { setCampaignStatus } from '$lib/server/campaigns/client';
import type { Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { campaign_ad_groups, campaign_ad_packages, campaign_pages } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
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

function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');

	return slug.length > 0 ? slug : 'landing-page';
}

async function resolvePublishedCampaignSlug(
	campaignId: number,
	selectedCampaignPageId: number
): Promise<string> {
	const [selectedPage] = await db
		.select({
			slug: campaign_pages.slug,
			structuredContentJson: campaign_pages.structured_content_json
		})
		.from(campaign_pages)
		.where(
			and(eq(campaign_pages.id, selectedCampaignPageId), eq(campaign_pages.campaign_id, campaignId))
		)
		.limit(1);

	if (!selectedPage) {
		throw error(404, 'Campaign page not found');
	}

	const [existingPublishedPage] = await db
		.select({ slug: campaign_pages.slug })
		.from(campaign_pages)
		.where(and(eq(campaign_pages.campaign_id, campaignId), eq(campaign_pages.is_published, true)))
		.orderBy(desc(campaign_pages.published_at), desc(campaign_pages.id))
		.limit(1);

	if (existingPublishedPage?.slug) {
		return existingPublishedPage.slug;
	}

	const rawContent = selectedPage.structuredContentJson;
	const titleCandidate =
		typeof rawContent === 'object' && rawContent !== null && 'title' in rawContent
			? rawContent.title
			: null;
	const cleanBaseSlug =
		typeof titleCandidate === 'string' && titleCandidate.trim().length > 0
			? slugify(titleCandidate)
			: slugify(selectedPage.slug);

	const [conflictingPublishedPage] = await db
		.select({ id: campaign_pages.id })
		.from(campaign_pages)
		.where(
			and(
				eq(campaign_pages.slug, cleanBaseSlug),
				eq(campaign_pages.is_published, true),
				eq(campaign_pages.campaign_id, campaignId)
			)
		)
		.limit(1);

	if (conflictingPublishedPage) {
		return cleanBaseSlug;
	}

	const [baseSlugTakenByOtherCampaign] = await db
		.select({ id: campaign_pages.id })
		.from(campaign_pages)
		.where(and(eq(campaign_pages.slug, cleanBaseSlug), eq(campaign_pages.is_published, true)))
		.limit(1);

	if (!baseSlugTakenByOtherCampaign) {
		return cleanBaseSlug;
	}

	return `${cleanBaseSlug}-c${campaignId}`;
}

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
	const [publishedCampaignPage] = await db
		.select({ id: campaign_pages.id, slug: campaign_pages.slug })
		.from(campaign_pages)
		.where(and(eq(campaign_pages.campaign_id, candidateId), eq(campaign_pages.is_published, true)))
		.orderBy(desc(campaign_pages.published_at), desc(campaign_pages.id))
		.limit(1);

	const liveLandingUrl = publishedCampaignPage?.slug
		? `${url.origin}/speaker/${publishedCampaignPage.slug}`
		: null;

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
		const candidatePageId = Number(formData.get('campaign_page_id'));

		if (!id) {
			return { success: false };
		}

		if (targetStatus === 'published') {
			let selectedCampaignPageId: number | null = null;

			if (Number.isFinite(candidatePageId) && candidatePageId > 0) {
				const [selectedPage] = await db
					.select({ id: campaign_pages.id })
					.from(campaign_pages)
					.where(and(eq(campaign_pages.id, candidatePageId), eq(campaign_pages.campaign_id, id)))
					.limit(1);

				if (selectedPage) {
					selectedCampaignPageId = selectedPage.id;
				}
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

			if (selectedCampaignPageId) {
				const publishedSlug = await resolvePublishedCampaignSlug(id, selectedCampaignPageId);
				await db
					.update(campaign_pages)
					.set({ is_published: false, published_at: null, updated_at: new Date() })
					.where(eq(campaign_pages.campaign_id, id));

				await db
					.update(campaign_pages)
					.set({
						slug: publishedSlug,
						is_published: true,
						published_at: new Date(),
						updated_at: new Date()
					})
					.where(eq(campaign_pages.id, selectedCampaignPageId));

				const [latestAdPackage] = await db
					.select({ id: campaign_ad_packages.id })
					.from(campaign_ad_packages)
					.where(eq(campaign_ad_packages.campaign_id, id))
					.orderBy(desc(campaign_ad_packages.version_number))
					.limit(1);

				if (latestAdPackage) {
					await db
						.update(campaign_ad_groups)
						.set({ campaign_page_id: selectedCampaignPageId, updated_at: new Date() })
						.where(eq(campaign_ad_groups.ad_package_id, latestAdPackage.id));
				}
			}
		} else {
			await db
				.update(campaign_pages)
				.set({ is_published: false, published_at: null, updated_at: new Date() })
				.where(eq(campaign_pages.campaign_id, id));
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
