import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { parseLandingPageDocument } from '$lib/page-builder/page';
import {
	getOrCreateVisitorIdentifier,
	logCampaignVisit
} from '$lib/server/attribution/campaign-visits';
import { db } from '$lib/server/db';
import { campaign_pages, campaigns } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

const SPEAKER_EMAIL_LOCAL_PART = 'speaker';
const SPEAKER_EMAIL_DOMAIN = 'christophholz.com';
const DEFAULT_SPEAKER_EMAIL_SUBJECT = 'Request a talk';

function buildSpeakerMailtoHref(input: {
	campaignId: number | null;
	campaignPageId: number | null;
	subject?: string;
}): string {
	const hasCampaignContext =
		typeof input.campaignId === 'number' &&
		input.campaignId > 0 &&
		typeof input.campaignPageId === 'number' &&
		input.campaignPageId > 0;

	const aliasToken = hasCampaignContext ? `+cmp${input.campaignId}_cp${input.campaignPageId}` : '';
	const emailAddress = `${SPEAKER_EMAIL_LOCAL_PART}${aliasToken}@${SPEAKER_EMAIL_DOMAIN}`;
	const searchParams = new URLSearchParams();
	const subject = input.subject?.trim();

	if (subject) {
		searchParams.set('subject', subject);
	}

	const queryString = searchParams.toString();

	return `mailto:${emailAddress}${queryString ? `?${queryString}` : ''}`;
}

export const load: PageServerLoad = async ({ params, cookies, url, request }) => {
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
		.where(and(eq(campaign_pages.slug, slug), eq(campaigns.status, 'published')))
		.limit(1);

	if (!pageRecord) {
		throw error(404, 'Page not found');
	}

	const page = parseLandingPageDocument(pageRecord.structuredContentJson);

	const visitorIdentifier = getOrCreateVisitorIdentifier({
		cookies,
		secureCookie: url.protocol === 'https:'
	});

	try {
		await logCampaignVisit({
			campaignId: pageRecord.campaignId,
			campaignPageId: pageRecord.campaignPageId,
			slug,
			searchParams: url.searchParams,
			headers: request.headers,
			visitorIdentifier
		});
	} catch (visitLoggingError) {
		console.error('Campaign visit logging failed', visitLoggingError);
	}

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
