import { db } from '$lib/server/db';
import {
	campaigns,
	lead_events,
	lead_journeys,
	lead_messages,
	vw_lead_journey_enriched
} from '$lib/server/db/schema';
import {
	and,
	asc,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNotNull,
	notInArray,
	or,
	sql
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const CLOSED_STAGES = ['won', 'lost', 'cancelled', 'closed', 'disqualified', 'archived'] as const;
const ACTIVE_WINDOW_DAYS = 7;
const JOURNEY_LIMIT = 50;

type JourneyListRow = {
	id: string;
	contactEmail: string | null;
	contactName: string | null;
	currentStage: string;
	outcome: string | null;
	campaignId: number | null;
	campaignPageId: number | null;
	firstTouchType: string;
	firstTouchAt: Date;
	updatedAt: Date;
	autoResponseSentAt: Date | null;
	autoResponseMessageId: string | null;
	bookingLinkInviteEmailSentAt: Date | null;
	bookingLinkInviteEmailProviderMessageId: string | null;
	firstCampaignId: number | null;
	firstPageId: number | null;
	firstUtmSource: string | null;
	firstUtmMedium: string | null;
	firstUtmCampaign: string | null;
	firstReferrer: string | null;
	firstCtaKey: string | null;
	firstSeenAt: Date | null;
	lastCampaignId: number | null;
	lastPageId: number | null;
	lastUtmSource: string | null;
	lastUtmMedium: string | null;
	lastUtmCampaign: string | null;
	lastReferrer: string | null;
	lastCtaKey: string | null;
	lastSeenAt: Date | null;
	attributionModelVersion: string;
	hubspotContactId: string | null;
	hubspotDealId: string | null;
	createdAt: Date;
};

type JourneyEnrichedRow = {
	journeyId: string;
	journeyCampaignName: string | null;
	journeyPageSlug: string | null;
	journeyCreatedAt: Date | null;
	journeyUpdatedAt: Date | null;
	currentStage: string | null;
	outcome: string | null;
	contactEmail: string | null;
	contactName: string | null;
	firstTouchType: string | null;
	firstTouchAt: Date | null;
	firstCampaignName: string | null;
	firstPageSlug: string | null;
	firstUtmSource: string | null;
	firstUtmMedium: string | null;
	firstUtmCampaign: string | null;
	firstReferrer: string | null;
	firstCtaKey: string | null;
	firstSeenAt: Date | null;
	lastCampaignName: string | null;
	lastPageSlug: string | null;
	lastUtmSource: string | null;
	lastUtmMedium: string | null;
	lastUtmCampaign: string | null;
	lastReferrer: string | null;
	lastCtaKey: string | null;
	lastSeenAt: Date | null;
	attributionModelVersion: string | null;
};

type JourneyMessageRow = {
	id: string;
	direction: string;
	provider: string;
	providerMessageId: string;
	providerThreadId: string;
	fromEmail: string;
	toEmail: string;
	subject: string;
	bodyText: string;
	bodyHtml: string | null;
	classification: string | null;
	classificationConfidence: number | null;
	autoResponseDecision: string | null;
	autoResponseSentAt: Date | null;
	receivedAt: Date | null;
	sentAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	timestamp: Date;
};

type JourneyEventRow = {
	id: string;
	eventType: string;
	eventSource: string;
	eventPayload: Record<string, unknown>;
	ctaKey: string | null;
	ctaLabel: string | null;
	ctaSection: string | null;
	ctaVariant: string | null;
	campaignId: number | null;
	campaignPageId: number | null;
	resolvedCampaignName: string | null;
	resolvedPageSlug: string | null;
	occurredAt: Date;
};

type JourneyListItem = JourneyListRow &
	JourneyEnrichedRow & {
		campaignName: string | null;
		campaignPageSlug: string | null;
		messageCount: number;
		eventCount: number;
		lastMessageAt: Date | null;
		lastEventAt: Date | null;
		latestActivityAt: Date | null;
		latestActivityKind: 'message' | 'event' | 'journey';
	};

type JourneyDetail = JourneyListItem & {
	messages: JourneyMessageRow[];
	events: JourneyEventRow[];
};

function parseTextParam(value: string | null): string {
	return value?.trim() ?? '';
}

function parsePositiveIntParam(value: string | null): number | null {
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseBooleanParam(value: string | null): boolean {
	return value === '1' || value === 'true' || value === 'on';
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
	if (!value) return null;
	return value instanceof Date ? value : new Date(value);
}

function latestDate(...values: Array<Date | string | null | undefined>): Date | null {
	let latest: Date | null = null;
	for (const value of values) {
		const date = toDateOrNull(value);
		if (!date || Number.isNaN(date.getTime())) continue;
		if (!latest || date.getTime() > latest.getTime()) {
			latest = date;
		}
	}
	return latest;
}

export const load: PageServerLoad = async ({ url }) => {
	const query = parseTextParam(url.searchParams.get('q'));
	const stage = parseTextParam(url.searchParams.get('stage'));
	const campaignId = parsePositiveIntParam(url.searchParams.get('campaign'));
	const openOnly = parseBooleanParam(url.searchParams.get('openOnly'));
	const requestedJourneyId = parseTextParam(url.searchParams.get('journey'));
	const searchPattern = query.length > 0 ? `%${query}%` : null;
	const activeWindowStart = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

	const [
		campaignRows,
		stageRows,
		[totalJourneysRow],
		[openJourneysRow],
		[recentMessagesRow],
		[recentEventsRow],
		[autoResponseRow]
	] = await Promise.all([
		db
			.select({ id: campaigns.id, name: campaigns.name })
			.from(campaigns)
			.orderBy(asc(campaigns.name)),
		db.select({ stage: lead_journeys.current_stage }).from(lead_journeys),
		db.select({ count: sql<number>`count(*)::integer` }).from(lead_journeys),
		db
			.select({ count: sql<number>`count(*)::integer` })
			.from(lead_journeys)
			.where(notInArray(lead_journeys.current_stage, [...CLOSED_STAGES])),
		db
			.select({ count: sql<number>`count(*)::integer` })
			.from(lead_messages)
			.where(gte(lead_messages.created_at, activeWindowStart)),
		db
			.select({ count: sql<number>`count(*)::integer` })
			.from(lead_events)
			.where(gte(lead_events.occurred_at, activeWindowStart)),
		db
			.select({ count: sql<number>`count(*)::integer` })
			.from(lead_journeys)
			.where(isNotNull(lead_journeys.auto_response_sent_at))
	]);

	const stageOptions = Array.from(
		new Set(stageRows.map((row) => row.stage).filter((value): value is string => Boolean(value)))
	).sort((left, right) => left.localeCompare(right));

	const journeyWhereClauses: SQL[] = [];

	if (searchPattern) {
		const searchClause = or(
			ilike(lead_journeys.contact_email, searchPattern),
			ilike(lead_journeys.contact_name, searchPattern),
			sql`${lead_journeys.id}::text ilike ${searchPattern}`,
			ilike(lead_journeys.current_stage, searchPattern),
			ilike(lead_journeys.outcome, searchPattern)
		);

		if (searchClause) {
			journeyWhereClauses.push(searchClause);
		}
	}

	if (stage) {
		journeyWhereClauses.push(eq(lead_journeys.current_stage, stage));
	}

	if (campaignId) {
		journeyWhereClauses.push(eq(lead_journeys.campaign_id, campaignId));
	}

	if (openOnly) {
		journeyWhereClauses.push(notInArray(lead_journeys.current_stage, [...CLOSED_STAGES]));
	}

	const listRows = await db
		.select({
			id: lead_journeys.id,
			contactEmail: lead_journeys.contact_email,
			contactName: lead_journeys.contact_name,
			currentStage: lead_journeys.current_stage,
			outcome: lead_journeys.outcome,
			campaignId: lead_journeys.campaign_id,
			campaignPageId: lead_journeys.campaign_page_id,
			firstTouchType: lead_journeys.first_touch_type,
			firstTouchAt: lead_journeys.first_touch_at,
			updatedAt: lead_journeys.updated_at,
			autoResponseSentAt: lead_journeys.auto_response_sent_at,
			autoResponseMessageId: lead_journeys.auto_response_message_id,
			bookingLinkInviteEmailSentAt: lead_journeys.booking_link_invite_email_sent_at,
			bookingLinkInviteEmailProviderMessageId:
				lead_journeys.booking_link_invite_email_provider_message_id,
			firstCampaignId: lead_journeys.first_campaign_id,
			firstPageId: lead_journeys.first_page_id,
			firstUtmSource: lead_journeys.first_utm_source,
			firstUtmMedium: lead_journeys.first_utm_medium,
			firstUtmCampaign: lead_journeys.first_utm_campaign,
			firstReferrer: lead_journeys.first_referrer,
			firstCtaKey: lead_journeys.first_cta_key,
			firstSeenAt: lead_journeys.first_seen_at,
			lastCampaignId: lead_journeys.last_campaign_id,
			lastPageId: lead_journeys.last_page_id,
			lastUtmSource: lead_journeys.last_utm_source,
			lastUtmMedium: lead_journeys.last_utm_medium,
			lastUtmCampaign: lead_journeys.last_utm_campaign,
			lastReferrer: lead_journeys.last_referrer,
			lastCtaKey: lead_journeys.last_cta_key,
			lastSeenAt: lead_journeys.last_seen_at,
			attributionModelVersion: lead_journeys.attribution_model_version,
			hubspotContactId: lead_journeys.hubspot_contact_id,
			hubspotDealId: lead_journeys.hubspot_deal_id,
			createdAt: lead_journeys.created_at
		})
		.from(lead_journeys)
		.where(journeyWhereClauses.length > 0 ? and(...journeyWhereClauses) : undefined)
		.orderBy(desc(lead_journeys.updated_at))
		.limit(JOURNEY_LIMIT);

	const journeyIds = listRows.map((row) => row.id);

	const [enrichedRows, messageStatsRows, eventStatsRows] =
		journeyIds.length === 0
			? [[], [], []]
			: await Promise.all([
					db
						.select({
							journeyId: vw_lead_journey_enriched.journey_id,
							journeyCampaignName: vw_lead_journey_enriched.journey_campaign_name,
							journeyPageSlug: vw_lead_journey_enriched.journey_page_slug,
							journeyCreatedAt: vw_lead_journey_enriched.journey_created_at,
							journeyUpdatedAt: vw_lead_journey_enriched.journey_updated_at,
							currentStage: vw_lead_journey_enriched.current_stage,
							outcome: vw_lead_journey_enriched.outcome,
							contactEmail: vw_lead_journey_enriched.contact_email,
							contactName: vw_lead_journey_enriched.contact_name,
							firstTouchType: vw_lead_journey_enriched.first_touch_type,
							firstTouchAt: vw_lead_journey_enriched.first_touch_at,
							firstCampaignName: vw_lead_journey_enriched.first_campaign_name,
							firstPageSlug: vw_lead_journey_enriched.first_page_slug,
							firstUtmSource: vw_lead_journey_enriched.first_utm_source,
							firstUtmMedium: vw_lead_journey_enriched.first_utm_medium,
							firstUtmCampaign: vw_lead_journey_enriched.first_utm_campaign,
							firstReferrer: vw_lead_journey_enriched.first_referrer,
							firstCtaKey: vw_lead_journey_enriched.first_cta_key,
							firstSeenAt: vw_lead_journey_enriched.first_seen_at,
							lastCampaignName: vw_lead_journey_enriched.last_campaign_name,
							lastPageSlug: vw_lead_journey_enriched.last_page_slug,
							lastUtmSource: vw_lead_journey_enriched.last_utm_source,
							lastUtmMedium: vw_lead_journey_enriched.last_utm_medium,
							lastUtmCampaign: vw_lead_journey_enriched.last_utm_campaign,
							lastReferrer: vw_lead_journey_enriched.last_referrer,
							lastCtaKey: vw_lead_journey_enriched.last_cta_key,
							lastSeenAt: vw_lead_journey_enriched.last_seen_at,
							attributionModelVersion: vw_lead_journey_enriched.attribution_model_version
						})
						.from(vw_lead_journey_enriched)
						.where(inArray(vw_lead_journey_enriched.journey_id, journeyIds)),
					db
						.select({
							journeyId: lead_messages.lead_journey_id,
							messageCount: sql<number>`count(*)::integer`,
							lastMessageAt: sql<Date | null>`max(coalesce(${lead_messages.received_at}, ${lead_messages.sent_at}, ${lead_messages.created_at}))`
						})
						.from(lead_messages)
						.where(inArray(lead_messages.lead_journey_id, journeyIds))
						.groupBy(lead_messages.lead_journey_id),
					db
						.select({
							journeyId: lead_events.lead_journey_id,
							eventCount: sql<number>`count(*)::integer`,
							lastEventAt: sql<Date | null>`max(${lead_events.occurred_at})`
						})
						.from(lead_events)
						.where(inArray(lead_events.lead_journey_id, journeyIds))
						.groupBy(lead_events.lead_journey_id)
				]);

	const enrichedById = new Map(enrichedRows.map((row) => [row.journeyId, row]));
	const messageStatsById = new Map(messageStatsRows.map((row) => [row.journeyId, row]));
	const eventStatsById = new Map(eventStatsRows.map((row) => [row.journeyId, row]));

	const journeys: JourneyListItem[] = listRows.map((row) => {
		const enriched = enrichedById.get(row.id);
		const messageStats = messageStatsById.get(row.id);
		const eventStats = eventStatsById.get(row.id);
		const lastMessageAt = toDateOrNull(messageStats?.lastMessageAt);
		const lastEventAt = toDateOrNull(eventStats?.lastEventAt);
		const latestActivityAt = latestDate(row.updatedAt, lastMessageAt, lastEventAt);

		return {
			journeyId: enriched?.journeyId ?? row.id,
			...row,
			journeyCampaignName: enriched?.journeyCampaignName ?? null,
			journeyPageSlug: enriched?.journeyPageSlug ?? null,
			journeyCreatedAt: enriched?.journeyCreatedAt ?? null,
			journeyUpdatedAt: enriched?.journeyUpdatedAt ?? null,
			currentStage: enriched?.currentStage ?? row.currentStage,
			outcome: enriched?.outcome ?? row.outcome,
			contactEmail: enriched?.contactEmail ?? row.contactEmail,
			contactName: enriched?.contactName ?? row.contactName,
			firstTouchType: enriched?.firstTouchType ?? row.firstTouchType,
			firstTouchAt: enriched?.firstTouchAt ?? row.firstTouchAt,
			firstCampaignName: enriched?.firstCampaignName ?? null,
			firstPageSlug: enriched?.firstPageSlug ?? null,
			firstUtmSource: enriched?.firstUtmSource ?? row.firstUtmSource,
			firstUtmMedium: enriched?.firstUtmMedium ?? row.firstUtmMedium,
			firstUtmCampaign: enriched?.firstUtmCampaign ?? row.firstUtmCampaign,
			firstReferrer: enriched?.firstReferrer ?? row.firstReferrer,
			firstCtaKey: enriched?.firstCtaKey ?? row.firstCtaKey,
			firstSeenAt: enriched?.firstSeenAt ?? row.firstSeenAt,
			lastCampaignName: enriched?.lastCampaignName ?? null,
			lastPageSlug: enriched?.lastPageSlug ?? null,
			lastUtmSource: enriched?.lastUtmSource ?? row.lastUtmSource,
			lastUtmMedium: enriched?.lastUtmMedium ?? row.lastUtmMedium,
			lastUtmCampaign: enriched?.lastUtmCampaign ?? row.lastUtmCampaign,
			lastReferrer: enriched?.lastReferrer ?? row.lastReferrer,
			lastCtaKey: enriched?.lastCtaKey ?? row.lastCtaKey,
			lastSeenAt: enriched?.lastSeenAt ?? row.lastSeenAt,
			attributionModelVersion: enriched?.attributionModelVersion ?? row.attributionModelVersion,
			campaignName:
				enriched?.journeyCampaignName ??
				enriched?.firstCampaignName ??
				enriched?.lastCampaignName ??
				null,
			campaignPageSlug:
				enriched?.journeyPageSlug ?? enriched?.firstPageSlug ?? enriched?.lastPageSlug ?? null,
			messageCount: messageStats?.messageCount ?? 0,
			eventCount: eventStats?.eventCount ?? 0,
			lastMessageAt,
			lastEventAt,
			latestActivityAt,
			latestActivityKind:
				lastMessageAt && lastEventAt
					? lastMessageAt.getTime() >= lastEventAt.getTime()
						? 'message'
						: 'event'
					: lastMessageAt
						? 'message'
						: lastEventAt
							? 'event'
							: 'journey'
		};
	});

	const selectedJourneyId = journeys.some((journey) => journey.id === requestedJourneyId)
		? requestedJourneyId
		: (journeys[0]?.id ?? null);

	let selectedJourney: JourneyDetail | null = null;

	if (selectedJourneyId) {
		const base = journeys.find((journey) => journey.id === selectedJourneyId) ?? null;
		const [messageRows, eventRows] = await Promise.all([
			db
				.select({
					id: lead_messages.id,
					direction: lead_messages.direction,
					provider: lead_messages.provider,
					providerMessageId: lead_messages.provider_message_id,
					providerThreadId: lead_messages.provider_thread_id,
					fromEmail: lead_messages.from_email,
					toEmail: lead_messages.to_email,
					subject: lead_messages.subject,
					bodyText: lead_messages.body_text,
					bodyHtml: lead_messages.body_html,
					classification: lead_messages.classification,
					classificationConfidence: lead_messages.classification_confidence,
					autoResponseDecision: lead_messages.auto_response_decision,
					autoResponseSentAt: lead_messages.auto_response_sent_at,
					receivedAt: lead_messages.received_at,
					sentAt: lead_messages.sent_at,
					createdAt: lead_messages.created_at,
					updatedAt: lead_messages.updated_at,
					timestamp: sql<Date>`coalesce(${lead_messages.received_at}, ${lead_messages.sent_at}, ${lead_messages.created_at})`
				})
				.from(lead_messages)
				.where(eq(lead_messages.lead_journey_id, selectedJourneyId))
				.orderBy(desc(lead_messages.created_at)),
			db
				.select({
					id: lead_events.id,
					eventType: lead_events.event_type,
					eventSource: lead_events.event_source,
					eventPayload: lead_events.event_payload,
					ctaKey: lead_events.cta_key,
					ctaLabel: lead_events.cta_label,
					ctaSection: lead_events.cta_section,
					ctaVariant: lead_events.cta_variant,
					campaignId: lead_events.campaign_id,
					campaignPageId: lead_events.campaign_page_id,
					resolvedCampaignName: vw_lead_journey_enriched.journey_campaign_name,
					resolvedPageSlug: vw_lead_journey_enriched.journey_page_slug,
					occurredAt: lead_events.occurred_at
				})
				.from(lead_events)
				.leftJoin(
					vw_lead_journey_enriched,
					eq(vw_lead_journey_enriched.journey_id, lead_events.lead_journey_id)
				)
				.where(eq(lead_events.lead_journey_id, selectedJourneyId))
				.orderBy(desc(lead_events.occurred_at))
		]);

		selectedJourney = {
			...base!,
			messages: messageRows.map((row) => ({
				...row,
				timestamp: toDateOrNull(row.timestamp) ?? row.createdAt
			})),
			events: eventRows.map((row) => ({
				...row,
				eventPayload: row.eventPayload as Record<string, unknown>
			}))
		};
	}

	return {
		filters: {
			q: query,
			stage,
			campaign: campaignId,
			openOnly
		},
		campaigns: campaignRows,
		stageOptions,
		summary: {
			totalJourneys: totalJourneysRow.count,
			openJourneys: openJourneysRow.count,
			recentMessages: recentMessagesRow.count,
			recentEvents: recentEventsRow.count,
			autoResponsesSent: autoResponseRow.count,
			filteredJourneys: journeys.length
		},
		journeys,
		selectedJourney
	};
};
