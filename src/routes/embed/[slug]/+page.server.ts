import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { parseLandingPageDocument } from '$lib/page-builder/page';
import {
	buildSpeakerMailtoHref,
	DEFAULT_SPEAKER_EMAIL_SUBJECT
} from '$lib/server/attribution/mailto';
import { db } from '$lib/server/db';
import { campaign_pages, campaigns } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, url }) => {
	const slug = params.slug?.trim();

	if (!slug) {
		throw error(404, 'Page not found');
	}

	const [pageRecord] = await db
		.select({
			structuredContentJson: campaign_pages.structured_content_json,
			campaignId: campaign_pages.campaign_id,
			campaignPageId: campaign_pages.id
		})
		.from(campaign_pages)
		.innerJoin(campaigns, eq(campaigns.id, campaign_pages.campaign_id))
		.where(eq(campaign_pages.slug, slug))
		.limit(1);

	if (!pageRecord) {
		throw error(404, 'Page not found');
	}

	const page = parseLandingPageDocument(pageRecord.structuredContentJson);

	return {
		page,
		campaignId: pageRecord.campaignId,
		campaignPageId: pageRecord.campaignPageId,
		speakerMailtoHref: buildSpeakerMailtoHref({
			campaignId: pageRecord.campaignId,
			campaignPageId: pageRecord.campaignPageId,
			subject: DEFAULT_SPEAKER_EMAIL_SUBJECT
		})
	};
};
