import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { christophSampleLandingPage, parseLandingPageDocument } from '$lib/page-builder/page';
import { db } from '$lib/server/db';
import { campaign_pages } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const candidatePageId = url.searchParams.get('campaignPageId');

	if (!candidatePageId) {
		const page = parseLandingPageDocument(christophSampleLandingPage);

		return {
			page,
			campaignId: null,
			campaignPageId: null
		};
	}

	const campaignPageId = Number(candidatePageId);
	if (!Number.isFinite(campaignPageId) || campaignPageId <= 0) {
		throw error(400, 'Invalid campaignPageId');
	}

	const [pageRecord] = await db
		.select({
			structuredContentJson: campaign_pages.structured_content_json,
			campaignId: campaign_pages.campaign_id,
			campaignPageId: campaign_pages.id
		})
		.from(campaign_pages)
		.where(eq(campaign_pages.id, campaignPageId))
		.limit(1);

	if (!pageRecord) {
		throw error(404, `Campaign page ${campaignPageId} not found`);
	}

	const page = parseLandingPageDocument(pageRecord.structuredContentJson);

	return {
		page,
		campaignId: pageRecord.campaignId,
		campaignPageId: pageRecord.campaignPageId
	};
};
