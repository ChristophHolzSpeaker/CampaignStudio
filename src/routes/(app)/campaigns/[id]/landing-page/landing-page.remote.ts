import { error } from '@sveltejs/kit';
import { query } from '$app/server';
import { db } from '$lib/server/db';
import { campaign_pages, keynotes, logos, media_assets } from '$lib/server/db/schema';
import {
	christophSampleLandingPage,
	parseLandingPageDocument,
	safeParseLandingPageDocument
} from '$lib/page-builder/page';
import { getCampaignById } from '$lib/server/campaigns/client';
import { getArtifactPageById } from '$lib/server/artifacts/repository';
import type { PageRendererType } from '$lib/page-url';
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const previewInputSchema = z.object({
	campaignId: z.number().int().positive(),
	version: z.number().int().positive().optional()
});

function isMissingChangeNoteColumnError(input: unknown): boolean {
	if (!(input instanceof Error)) {
		return false;
	}

	const message = input.message.toLowerCase();
	return message.includes('change_note') && message.includes('does not exist');
}

export const getLandingPagePreview = query(previewInputSchema, async ({ campaignId, version }) => {
	const campaign = await getCampaignById(campaignId);
	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	let pageRecords: Array<{
		structuredContentJson: unknown;
		campaignPageId: number;
		versionNumber: number;
		rendererType: PageRendererType;
		isPublished: boolean;
		changeNote: string | null;
		slug: string;
		createdAt: Date;
	}> = [];

	try {
		pageRecords = await db
			.select({
				structuredContentJson: campaign_pages.structured_content_json,
				campaignPageId: campaign_pages.id,
				versionNumber: campaign_pages.version_number,
				rendererType: campaign_pages.renderer_type,
				isPublished: campaign_pages.is_published,
				changeNote: campaign_pages.change_note,
				slug: campaign_pages.slug,
				createdAt: campaign_pages.created_at
			})
			.from(campaign_pages)
			.where(eq(campaign_pages.campaign_id, campaignId))
			.orderBy(desc(campaign_pages.version_number))
			.limit(30);
	} catch (queryError) {
		if (!isMissingChangeNoteColumnError(queryError)) {
			throw queryError;
		}

		const legacyRecords = await db
			.select({
				structuredContentJson: campaign_pages.structured_content_json,
				campaignPageId: campaign_pages.id,
				versionNumber: campaign_pages.version_number,
				rendererType: campaign_pages.renderer_type,
				isPublished: campaign_pages.is_published,
				slug: campaign_pages.slug,
				createdAt: campaign_pages.created_at
			})
			.from(campaign_pages)
			.where(eq(campaign_pages.campaign_id, campaignId))
			.orderBy(desc(campaign_pages.version_number))
			.limit(30);

		pageRecords = legacyRecords.map((record) => ({ ...record, changeNote: null }));
	}

	const [latestPageRecord] = pageRecords;
	const selectedPageRecord =
		version != null
			? (pageRecords.find((record) => record.campaignPageId === version) ?? latestPageRecord)
			: latestPageRecord;

	let page = parseLandingPageDocument(christophSampleLandingPage);
	let canRenderPage = true;
	let renderErrorMessage: string | null = null;

	if (selectedPageRecord?.rendererType === 'artifact') {
		const artifactPage = await getArtifactPageById(selectedPageRecord.campaignPageId);
		if (!artifactPage || artifactPage.campaignId !== campaignId) {
			canRenderPage = false;
			renderErrorMessage = 'This artifact version is incomplete and is unable to render.';
		}
	} else if (selectedPageRecord) {
		const parsedSelectedPage = safeParseLandingPageDocument(
			selectedPageRecord.structuredContentJson
		);
		if (parsedSelectedPage.success) {
			page = parsedSelectedPage.data;
		} else {
			canRenderPage = false;
			renderErrorMessage = 'This page version has incomplete content and is unable to render.';
		}
	}

	const availableLogos = await db
		.select({
			id: logos.id,
			name: logos.name,
			logoUrl: logos.logo_url,
			logoAlt: logos.logo_alt
		})
		.from(logos)
		.where(eq(logos.is_active, true))
		.orderBy(asc(logos.priority), asc(logos.name), asc(logos.id));

	const availableKeynotes = await db
		.select({
			id: keynotes.id,
			title: keynotes.keynote_title,
			summary: keynotes.keynote_short,
			imageUrl: keynotes.image_url,
			imageAlt: keynotes.image_alt
		})
		.from(keynotes)
		.where(eq(keynotes.status, 'active'))
		.orderBy(asc(keynotes.keynote_title), asc(keynotes.id));

	const availableKeynotesWithFallback = availableKeynotes.map((keynote) => ({
		...keynote,
		summary: keynote.summary ?? ''
	}));

	const availableHeroImages = await db
		.select({
			id: media_assets.id,
			kind: media_assets.kind,
			title: media_assets.title,
			primaryUrl: media_assets.primary_url,
			thumbnailUrl: media_assets.thumbnail_url,
			thumbnailAlt: media_assets.thumbnail_alt,
			sectionTypes: media_assets.section_types,
			priority: media_assets.priority
		})
		.from(media_assets)
		.where(eq(media_assets.is_active, true))
		.orderBy(asc(media_assets.priority), asc(media_assets.id));

	const filteredHeroImages = availableHeroImages.filter(
		(asset) => asset.kind === 'image' && asset.primaryUrl.trim().length > 0
	);

	return {
		page,
		canRenderPage,
		renderErrorMessage,
		availableLogos,
		availableKeynotes: availableKeynotesWithFallback,
		availableHeroImages: filteredHeroImages,
		campaignId,
		campaignPageId: selectedPageRecord?.campaignPageId ?? null,
		rendererType: selectedPageRecord?.rendererType ?? 'sections',
		latestCampaignPageId: latestPageRecord?.campaignPageId ?? null,
		versionHistory: pageRecords.map((record) => ({
			id: record.campaignPageId,
			versionNumber: record.versionNumber,
			rendererType: record.rendererType,
			isPublished: record.isPublished,
			changeNote: record.changeNote,
			slug: record.slug,
			createdAt: record.createdAt
		})),
		campaignStatus: campaign.status
	};
});
