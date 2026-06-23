import { db } from '$lib/server/db';
import { lead_journeys } from '$lib/server/db/schema';
import { publicApiJson, requirePublicApiRequest } from '$lib/server/public-api/http';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ request, params }) => {
	const guard = await requirePublicApiRequest(request);
	if (!guard.ok) return guard.response;

	if (!UUID_PATTERN.test(params.id)) {
		return publicApiJson({ ok: false, error: 'Invalid journey id' }, guard.context, {
			status: 400
		});
	}

	const [row] = await db
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
		.where(eq(lead_journeys.id, params.id))
		.limit(1);

	if (!row) {
		return publicApiJson({ ok: false, error: 'Journey not found' }, guard.context, { status: 404 });
	}

	return publicApiJson({ ok: true, data: row }, guard.context);
};
