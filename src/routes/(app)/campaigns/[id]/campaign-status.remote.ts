import { error } from '@sveltejs/kit';
import { form } from '$app/server';
import { setCampaignStatus } from '$lib/server/campaigns/client';
import { db } from '$lib/server/db';
import { campaign_ad_groups, campaign_ad_packages, campaign_pages } from '$lib/server/db/schema';
import { traceLlm } from '$lib/server/telemetry/llm-trace';
import { and, desc, eq } from 'drizzle-orm';

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

function readSingleString(input: unknown): string | undefined {
	if (typeof input === 'string') {
		return input;
	}

	if (Array.isArray(input)) {
		const first = input[0];
		return typeof first === 'string' ? first : undefined;
	}

	return undefined;
}

export const publishCampaign = form('unchecked', async (rawData) => {
	const id = Number(readSingleString(rawData.id));
	const targetStatus = readSingleString(rawData.target_status) ?? 'draft';
	const candidatePageId = Number(readSingleString(rawData.campaign_page_id));

	if (!Number.isFinite(id) || id <= 0) {
		return { success: false };
	}

	if (targetStatus === 'published') {
		traceLlm(
			'publish_action',
			{ pipeline: 'landing_page', campaignId: id },
			{
				action: 'publish_requested',
				targetStatus,
				candidatePageId: Number.isFinite(candidatePageId) ? candidatePageId : null
			}
		);
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

			traceLlm(
				'publish_action',
				{ pipeline: 'landing_page', campaignId: id },
				{
					action: 'page_published',
					selectedCampaignPageId,
					publishedSlug
				}
			);

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

				traceLlm(
					'ad_group_relink_action',
					{ pipeline: 'landing_page', campaignId: id },
					{
						action: 'publish_relink_latest_ad_package',
						adPackageId: latestAdPackage.id,
						campaignPageId: selectedCampaignPageId
					}
				);
			}
		}
	} else {
		traceLlm(
			'publish_action',
			{ pipeline: 'landing_page', campaignId: id },
			{
				action: 'unpublish_requested',
				targetStatus
			}
		);
		await db
			.update(campaign_pages)
			.set({ is_published: false, published_at: null, updated_at: new Date() })
			.where(eq(campaign_pages.campaign_id, id));
	}

	await setCampaignStatus(id, targetStatus);

	return { success: true };
});
