import { db } from '$lib/server/db';
import { lead_journeys } from '$lib/server/db/schema';
import {
	parseOptionalDate,
	parseOptionalPositiveInt,
	parsePositiveInt,
	publicApiJson,
	requirePublicApiRequest
} from '$lib/server/public-api/http';
import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const GET: RequestHandler = async ({ request, url }) => {
	const guard = await requirePublicApiRequest(request);
	if (!guard.ok) return guard.response;

	const limit = parsePositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
	const campaignId = parseOptionalPositiveInt(url.searchParams.get('campaign_id'));
	const stage = url.searchParams.get('stage');
	const updatedAfter = parseOptionalDate(url.searchParams.get('updated_after'));
	const updatedBefore = parseOptionalDate(url.searchParams.get('updated_before'));

	const whereClauses: SQL[] = [];
	if (campaignId) whereClauses.push(eq(lead_journeys.campaign_id, campaignId));
	if (stage) whereClauses.push(eq(lead_journeys.current_stage, stage));
	if (updatedAfter) whereClauses.push(gte(lead_journeys.updated_at, updatedAfter));
	if (updatedBefore) whereClauses.push(lt(lead_journeys.updated_at, updatedBefore));

	const rows = await db
		.select({
			id: lead_journeys.id,
			campaignId: lead_journeys.campaign_id,
			campaignPageId: lead_journeys.campaign_page_id,
			firstVisitId: lead_journeys.first_visit_id,
			firstCampaignId: lead_journeys.first_campaign_id,
			firstPageId: lead_journeys.first_page_id,
			firstUtmSource: lead_journeys.first_utm_source,
			firstUtmMedium: lead_journeys.first_utm_medium,
			firstUtmCampaign: lead_journeys.first_utm_campaign,
			firstReferrer: lead_journeys.first_referrer,
			firstCtaKey: lead_journeys.first_cta_key,
			firstSeenAt: lead_journeys.first_seen_at,
			lastVisitId: lead_journeys.last_visit_id,
			lastCampaignId: lead_journeys.last_campaign_id,
			lastPageId: lead_journeys.last_page_id,
			lastUtmSource: lead_journeys.last_utm_source,
			lastUtmMedium: lead_journeys.last_utm_medium,
			lastUtmCampaign: lead_journeys.last_utm_campaign,
			lastReferrer: lead_journeys.last_referrer,
			lastCtaKey: lead_journeys.last_cta_key,
			lastSeenAt: lead_journeys.last_seen_at,
			attributionModelVersion: lead_journeys.attribution_model_version,
			firstTouchType: lead_journeys.first_touch_type,
			firstTouchAt: lead_journeys.first_touch_at,
			contactEmail: lead_journeys.contact_email,
			contactName: lead_journeys.contact_name,
			currentStage: lead_journeys.current_stage,
			hubspotContactId: lead_journeys.hubspot_contact_id,
			hubspotDealId: lead_journeys.hubspot_deal_id,
			autoResponseSentAt: lead_journeys.auto_response_sent_at,
			autoResponseMessageId: lead_journeys.auto_response_message_id,
			bookingLinkInviteEmailSentAt: lead_journeys.booking_link_invite_email_sent_at,
			bookingLinkInviteEmailProviderMessageId:
				lead_journeys.booking_link_invite_email_provider_message_id,
			outcome: lead_journeys.outcome,
			createdAt: lead_journeys.created_at,
			updatedAt: lead_journeys.updated_at
		})
		.from(lead_journeys)
		.where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
		.orderBy(desc(lead_journeys.updated_at), desc(lead_journeys.created_at))
		.limit(limit);

	return publicApiJson(
		{
			ok: true,
			data: rows,
			pagination: {
				limit,
				count: rows.length,
				nextUpdatedBefore: rows.length === limit ? rows.at(-1)?.updatedAt : null
			}
		},
		guard.context
	);
};
