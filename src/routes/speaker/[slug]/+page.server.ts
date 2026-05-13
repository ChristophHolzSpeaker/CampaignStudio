import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { parseLandingPageDocument } from '$lib/page-builder/page';
import {
	getOrCreateVisitorIdentifier,
	logCampaignVisit
} from '$lib/server/attribution/campaign-visits';
import {
	buildSpeakerMailtoHref,
	DEFAULT_SPEAKER_EMAIL_SUBJECT
} from '$lib/server/attribution/mailto';
import { db } from '$lib/server/db';
import { campaign_pages, campaigns } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { resolvePublicBookingSlotPreview } from '$lib/server/bookings';

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
		.where(
			and(
				eq(campaign_pages.slug, slug),
				eq(campaign_pages.is_published, true),
				eq(campaigns.status, 'published')
			)
		)
		.limit(1);

	if (!pageRecord) {
		throw error(404, 'Page not found');
	}

	const page = parseLandingPageDocument(pageRecord.structuredContentJson);
	const slotPreview = await resolvePublicBookingSlotPreview({ bookingType: 'lead' });

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
		bookingSlotGroups: slotPreview.slotGroups,
		speakerMailtoHref: buildSpeakerMailtoHref({
			campaignId: pageRecord.campaignId,
			campaignPageId: pageRecord.campaignPageId,
			subject: DEFAULT_SPEAKER_EMAIL_SUBJECT
		})
	};
};
