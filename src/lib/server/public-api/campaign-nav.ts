import { desc } from 'drizzle-orm';
import { parseLandingPageDocument, type LandingPageDocument } from '$lib/page-builder/page';
import { db } from '$lib/server/db';
import { campaign_pages, campaigns } from '$lib/server/db/schema';
import { buildEmbedPreviewUrl } from './embed-token';

export type PublicCampaignPageNavItem = {
	campaignPageId: number;
	versionNumber: number;
	title: string;
	slug: string;
	isPublished: boolean;
	publishedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	heroImageUrl: string | null;
	embedUrl: string;
	liveUrl: string | null;
};

export type PublicCampaignNavItem = {
	campaignId: number;
	name: string;
	status: string;
	createdAt: Date;
	updatedAt: Date;
	pages: PublicCampaignPageNavItem[];
};

function getHeroImageUrl(page: LandingPageDocument): string | null {
	const heroSection = page.sections.find((section) => section.type === 'immediate_authority_hero');

	if (!heroSection || heroSection.type !== 'immediate_authority_hero') {
		return null;
	}

	return (
		heroSection.props.heroImageUrl?.trim() || heroSection.props.videoThumbnailUrl.trim() || null
	);
}

export async function listPublicCampaignNavItems(origin: string): Promise<PublicCampaignNavItem[]> {
	const [campaignRows, pageRows] = await Promise.all([
		db
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status,
				createdAt: campaigns.created_at,
				updatedAt: campaigns.updated_at
			})
			.from(campaigns)
			.orderBy(desc(campaigns.created_at), desc(campaigns.id)),
		db
			.select({
				id: campaign_pages.id,
				campaignId: campaign_pages.campaign_id,
				versionNumber: campaign_pages.version_number,
				structuredContentJson: campaign_pages.structured_content_json,
				slug: campaign_pages.slug,
				isPublished: campaign_pages.is_published,
				publishedAt: campaign_pages.published_at,
				createdAt: campaign_pages.created_at,
				updatedAt: campaign_pages.updated_at
			})
			.from(campaign_pages)
			.orderBy(desc(campaign_pages.created_at), desc(campaign_pages.id))
	]);

	const pagesByCampaignId = new Map<number, PublicCampaignPageNavItem[]>();

	for (const pageRow of pageRows) {
		const page = parseLandingPageDocument(pageRow.structuredContentJson);
		const navPage: PublicCampaignPageNavItem = {
			campaignPageId: pageRow.id,
			versionNumber: pageRow.versionNumber,
			title: page.title,
			slug: pageRow.slug,
			isPublished: pageRow.isPublished,
			publishedAt: pageRow.publishedAt,
			createdAt: pageRow.createdAt,
			updatedAt: pageRow.updatedAt,
			heroImageUrl: getHeroImageUrl(page),
			embedUrl: buildEmbedPreviewUrl(origin, {
				campaignPageId: pageRow.id,
				slug: pageRow.slug
			}),
			liveUrl: pageRow.isPublished ? new URL(`/speaker/${pageRow.slug}`, origin).href : null
		};

		const existingPages = pagesByCampaignId.get(pageRow.campaignId) ?? [];
		existingPages.push(navPage);
		pagesByCampaignId.set(pageRow.campaignId, existingPages);
	}

	return campaignRows.map((campaign) => ({
		campaignId: campaign.id,
		name: campaign.name,
		status: campaign.status,
		createdAt: campaign.createdAt,
		updatedAt: campaign.updatedAt,
		pages: pagesByCampaignId.get(campaign.id) ?? []
	}));
}
