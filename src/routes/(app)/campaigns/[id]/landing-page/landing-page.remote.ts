import { error } from '@sveltejs/kit';
import { query } from '$app/server';
import { db } from '$lib/server/db';
import { campaign_pages, keynotes, logos } from '$lib/server/db/schema';
import {
	christophSampleLandingPage,
	parseLandingPageDocument,
	safeParseLandingPageDocument
} from '$lib/page-builder/page';
import { getCampaignById } from '$lib/server/campaigns/client';
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

	if (selectedPageRecord) {
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
			summary: keynotes.keynote_summary,
			imageUrl: keynotes.image_url,
			imageAlt: keynotes.image_alt
		})
		.from(keynotes)
		.where(eq(keynotes.is_active, true))
		.orderBy(asc(keynotes.keynote_title), asc(keynotes.id));

	return {
		page,
		canRenderPage,
		renderErrorMessage,
		availableLogos,
		availableKeynotes,
		campaignId,
		campaignPageId: selectedPageRecord?.campaignPageId ?? null,
		latestCampaignPageId: latestPageRecord?.campaignPageId ?? null,
		versionHistory: pageRecords.map((record) => ({
			id: record.campaignPageId,
			versionNumber: record.versionNumber,
			changeNote: record.changeNote,
			slug: record.slug,
			createdAt: record.createdAt
		})),
		campaignStatus: campaign.status
	};
});
