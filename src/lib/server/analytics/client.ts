import { db } from '$lib/server/db';
import {
	vw_booking_enriched,
	vw_campaign_conversion_summary,
	vw_cta_performance,
	vw_direct_email_funnel_daily,
	vw_funnel_daily,
	vw_lead_event_enriched,
	vw_lead_journey_enriched,
	vw_visit_enriched,
	vw_source_medium_performance
} from '$lib/server/db/schema';
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm';

export type DateWindow = {
	from: Date;
	toExclusive: Date;
};

export type FunnelDailyPoint = {
	reportDate: string;
	visits: number;
	uniqueVisitors: number;
	journeysCreated: number;
	identifiedLeads: number;
	inboundMessages: number;
	bookingLinkClicked: number;
	bookingsCompleted: number;
	visitToLeadRate: number;
	leadToBookingRate: number;
	visitToBookingRate: number;
};

export type OverviewKpis = {
	visits: number;
	uniqueVisitors: number;
	identifiedLeads: number;
	bookingsCompleted: number;
	visitToLeadRate: number;
	leadToBookingRate: number;
	visitToBookingRate: number;
};

export type DirectEmailDailyPoint = {
	reportDate: string;
	visits: number;
	directEmailCtaClicks: number;
	aliasInboundMessages: number;
	directEmailEntries: number;
	emailFirstTouchBookings: number;
	visitToDirectEmailRate: number;
	emailToBookingRate: number;
};

export type DirectEmailSummary = {
	visits: number;
	directEmailCtaClicks: number;
	aliasInboundMessages: number;
	directEmailEntries: number;
	emailFirstTouchBookings: number;
	visitToDirectEmailRate: number;
	emailToBookingRate: number;
};

export type CampaignConversionRow = {
	campaignId: number | null;
	campaignName: string | null;
	visitCampaignVisits: number;
	journeyCampaignLeads: number;
	firstTouchLeads: number;
	firstTouchBookings: number;
	visitToJourneyLeadRate: number;
	visitToFirstTouchLeadRate: number;
	firstTouchLeadToBookingRate: number;
	visitToFirstTouchBookingRate: number;
};

export type SourceMediumPerformanceRow = {
	utmSource: string | null;
	utmMedium: string | null;
	visitTouchVisits: number;
	firstTouchLeads: number;
	firstTouchBookings: number;
	visitToFirstTouchLeadRate: number;
	firstTouchLeadToBookingRate: number;
	visitToFirstTouchBookingRate: number;
};

export type CtaPerformanceRow = {
	ctaKey: string | null;
	ctaLabel: string | null;
	ctaSection: string | null;
	ctaVariant: string | null;
	clicks: number;
	firstTouchLeads: number;
	firstTouchBookings: number;
	clickToFirstTouchLeadRate: number;
	clickToFirstTouchBookingRate: number;
};

const toNumber = (value: number | null | undefined): number => value ?? 0;

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const toDateLabel = (value: Date | string | null | undefined, fallback: Date): string => {
	if (value instanceof Date && isValidDate(value)) {
		return value.toISOString().slice(0, 10);
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
			return trimmed.slice(0, 10);
		}

		const parsed = new Date(trimmed);
		if (isValidDate(parsed)) {
			return parsed.toISOString().slice(0, 10);
		}
	}

	return fallback.toISOString().slice(0, 10);
};

const ratio = (numerator: number, denominator: number): number => {
	if (denominator <= 0) {
		return 0;
	}

	return numerator / denominator;
};

export async function getFunnelDaily(window: DateWindow): Promise<FunnelDailyPoint[]> {
	const rows = await db
		.select()
		.from(vw_funnel_daily)
		.where(
			and(
				gte(vw_funnel_daily.report_date, window.from),
				lt(vw_funnel_daily.report_date, window.toExclusive)
			)
		)
		.orderBy(asc(vw_funnel_daily.report_date));

	return rows.map((row) => ({
		reportDate: toDateLabel(row.report_date, window.from),
		visits: toNumber(row.visits),
		uniqueVisitors: toNumber(row.unique_visitors),
		journeysCreated: toNumber(row.journeys_created),
		identifiedLeads: toNumber(row.identified_leads),
		inboundMessages: toNumber(row.inbound_messages),
		bookingLinkClicked: toNumber(row.booking_link_clicked),
		bookingsCompleted: toNumber(row.bookings_completed),
		visitToLeadRate: row.visit_to_lead_rate ?? 0,
		leadToBookingRate: row.lead_to_booking_rate ?? 0,
		visitToBookingRate: row.visit_to_booking_rate ?? 0
	}));
}

export function buildOverviewKpis(funnelDaily: readonly FunnelDailyPoint[]): OverviewKpis {
	const totals = funnelDaily.reduce(
		(acc, point) => {
			acc.visits += point.visits;
			acc.uniqueVisitors += point.uniqueVisitors;
			acc.identifiedLeads += point.identifiedLeads;
			acc.bookingsCompleted += point.bookingsCompleted;

			return acc;
		},
		{
			visits: 0,
			uniqueVisitors: 0,
			identifiedLeads: 0,
			bookingsCompleted: 0
		}
	);

	return {
		...totals,
		visitToLeadRate: ratio(totals.identifiedLeads, totals.visits),
		leadToBookingRate: ratio(totals.bookingsCompleted, totals.identifiedLeads),
		visitToBookingRate: ratio(totals.bookingsCompleted, totals.visits)
	};
}

export async function getDirectEmailFunnelDaily(
	window: DateWindow
): Promise<DirectEmailDailyPoint[]> {
	const rows = await db
		.select()
		.from(vw_direct_email_funnel_daily)
		.where(
			and(
				gte(vw_direct_email_funnel_daily.report_date, window.from),
				lt(vw_direct_email_funnel_daily.report_date, window.toExclusive)
			)
		)
		.orderBy(asc(vw_direct_email_funnel_daily.report_date));

	return rows.map((row) => ({
		reportDate: toDateLabel(row.report_date, window.from),
		visits: toNumber(row.visits),
		directEmailCtaClicks: toNumber(row.direct_email_cta_clicks),
		aliasInboundMessages: toNumber(row.alias_inbound_messages),
		directEmailEntries: toNumber(row.direct_email_entries),
		emailFirstTouchBookings: toNumber(row.email_first_touch_bookings),
		visitToDirectEmailRate: row.visit_to_direct_email_rate ?? 0,
		emailToBookingRate: row.email_to_booking_rate ?? 0
	}));
}

export function buildDirectEmailSummary(
	directEmailDaily: readonly DirectEmailDailyPoint[]
): DirectEmailSummary {
	const totals = directEmailDaily.reduce(
		(acc, point) => {
			acc.visits += point.visits;
			acc.directEmailCtaClicks += point.directEmailCtaClicks;
			acc.aliasInboundMessages += point.aliasInboundMessages;
			acc.directEmailEntries += point.directEmailEntries;
			acc.emailFirstTouchBookings += point.emailFirstTouchBookings;

			return acc;
		},
		{
			visits: 0,
			directEmailCtaClicks: 0,
			aliasInboundMessages: 0,
			directEmailEntries: 0,
			emailFirstTouchBookings: 0
		}
	);

	return {
		...totals,
		visitToDirectEmailRate: ratio(totals.directEmailEntries, totals.visits),
		emailToBookingRate: ratio(totals.emailFirstTouchBookings, totals.directEmailEntries)
	};
}

export async function getCampaignConversionSummary(): Promise<CampaignConversionRow[]> {
	const rows = await db
		.select()
		.from(vw_campaign_conversion_summary)
		.orderBy(
			desc(vw_campaign_conversion_summary.first_touch_bookings),
			desc(vw_campaign_conversion_summary.first_touch_leads),
			desc(vw_campaign_conversion_summary.visit_campaign_visits)
		)
		.limit(50);

	return rows.map((row) => ({
		campaignId: row.campaign_id,
		campaignName: row.campaign_name,
		visitCampaignVisits: toNumber(row.visit_campaign_visits),
		journeyCampaignLeads: toNumber(row.journey_campaign_leads),
		firstTouchLeads: toNumber(row.first_touch_leads),
		firstTouchBookings: toNumber(row.first_touch_bookings),
		visitToJourneyLeadRate: row.visit_to_journey_lead_rate ?? 0,
		visitToFirstTouchLeadRate: row.visit_to_first_touch_lead_rate ?? 0,
		firstTouchLeadToBookingRate: row.first_touch_lead_to_booking_rate ?? 0,
		visitToFirstTouchBookingRate: row.visit_to_first_touch_booking_rate ?? 0
	}));
}

export async function getSourceMediumPerformance(): Promise<SourceMediumPerformanceRow[]> {
	const rows = await db
		.select()
		.from(vw_source_medium_performance)
		.orderBy(
			desc(vw_source_medium_performance.first_touch_bookings),
			desc(vw_source_medium_performance.first_touch_leads),
			desc(vw_source_medium_performance.visit_touch_visits)
		)
		.limit(50);

	return rows.map((row) => ({
		utmSource: row.utm_source,
		utmMedium: row.utm_medium,
		visitTouchVisits: toNumber(row.visit_touch_visits),
		firstTouchLeads: toNumber(row.first_touch_leads),
		firstTouchBookings: toNumber(row.first_touch_bookings),
		visitToFirstTouchLeadRate: row.visit_to_first_touch_lead_rate ?? 0,
		firstTouchLeadToBookingRate: row.first_touch_lead_to_booking_rate ?? 0,
		visitToFirstTouchBookingRate: row.visit_to_first_touch_booking_rate ?? 0
	}));
}

export async function getCtaPerformance(): Promise<CtaPerformanceRow[]> {
	const rows = await db
		.select()
		.from(vw_cta_performance)
		.orderBy(desc(vw_cta_performance.clicks), desc(vw_cta_performance.first_touch_bookings))
		.limit(50);

	return rows.map((row) => ({
		ctaKey: row.cta_key,
		ctaLabel: row.cta_label,
		ctaSection: row.cta_section,
		ctaVariant: row.cta_variant,
		clicks: toNumber(row.clicks),
		firstTouchLeads: toNumber(row.first_touch_leads),
		firstTouchBookings: toNumber(row.first_touch_bookings),
		clickToFirstTouchLeadRate: row.click_to_first_touch_lead_rate ?? 0,
		clickToFirstTouchBookingRate: row.click_to_first_touch_booking_rate ?? 0
	}));
}

type CampaignDailyAccumulator = {
	visits: number;
	uniqueVisitors: number;
	journeysCreated: number;
	identifiedLeads: number;
	inboundMessages: number;
	bookingLinkClicked: number;
	bookingsCompleted: number;
};

type CampaignDirectEmailDailyAccumulator = {
	visits: number;
	directEmailCtaClicks: number;
	aliasInboundMessages: number;
	emailFirstTouchBookings: number;
};

type SourceMediumAccumulator = {
	utmSource: string | null;
	utmMedium: string | null;
	visitTouchVisits: number;
	firstTouchLeads: number;
	firstTouchBookings: number;
};

type CtaAccumulator = {
	ctaKey: string;
	ctaLabel: string | null;
	ctaSection: string | null;
	ctaVariant: string | null;
	clicks: number;
	firstTouchLeads: number;
	firstTouchBookings: number;
};

const sourceMediumKey = (source: string | null, medium: string | null): string =>
	`${source ?? ''}::${medium ?? ''}`;

const toCampaignDailyMap = () => new Map<string, CampaignDailyAccumulator>();

const toDirectEmailDailyMap = () => new Map<string, CampaignDirectEmailDailyAccumulator>();

const getCampaignDailyAccumulator = (
	map: Map<string, CampaignDailyAccumulator>,
	reportDate: string
): CampaignDailyAccumulator => {
	const existing = map.get(reportDate);
	if (existing) {
		return existing;
	}

	const created: CampaignDailyAccumulator = {
		visits: 0,
		uniqueVisitors: 0,
		journeysCreated: 0,
		identifiedLeads: 0,
		inboundMessages: 0,
		bookingLinkClicked: 0,
		bookingsCompleted: 0
	};

	map.set(reportDate, created);
	return created;
};

const getDirectEmailAccumulator = (
	map: Map<string, CampaignDirectEmailDailyAccumulator>,
	reportDate: string
): CampaignDirectEmailDailyAccumulator => {
	const existing = map.get(reportDate);
	if (existing) {
		return existing;
	}

	const created: CampaignDirectEmailDailyAccumulator = {
		visits: 0,
		directEmailCtaClicks: 0,
		aliasInboundMessages: 0,
		emailFirstTouchBookings: 0
	};

	map.set(reportDate, created);
	return created;
};

export async function getFunnelDailyByCampaign(
	window: DateWindow,
	campaignId: number
): Promise<FunnelDailyPoint[]> {
	const [visitRows, journeyRows, identifiedRows, inboundRows, bookingClickRows, bookingRows] =
		await Promise.all([
			db
				.select({
					visitedAt: vw_visit_enriched.visited_at,
					visitorIdentifier: vw_visit_enriched.visitor_identifier
				})
				.from(vw_visit_enriched)
				.where(
					and(
						eq(vw_visit_enriched.campaign_id, campaignId),
						gte(vw_visit_enriched.visited_at, window.from),
						lt(vw_visit_enriched.visited_at, window.toExclusive)
					)
				),
			db
				.select({ journeyCreatedAt: vw_lead_journey_enriched.journey_created_at })
				.from(vw_lead_journey_enriched)
				.where(
					and(
						eq(vw_lead_journey_enriched.journey_campaign_id, campaignId),
						gte(vw_lead_journey_enriched.journey_created_at, window.from),
						lt(vw_lead_journey_enriched.journey_created_at, window.toExclusive)
					)
				),
			db
				.select({
					occurredAt: vw_lead_event_enriched.occurred_at,
					journeyId: vw_lead_event_enriched.journey_id
				})
				.from(vw_lead_event_enriched)
				.where(
					and(
						eq(vw_lead_event_enriched.event_type, 'lead_identified'),
						eq(vw_lead_event_enriched.resolved_campaign_id, campaignId),
						gte(vw_lead_event_enriched.occurred_at, window.from),
						lt(vw_lead_event_enriched.occurred_at, window.toExclusive)
					)
				),
			db
				.select({ occurredAt: vw_lead_event_enriched.occurred_at })
				.from(vw_lead_event_enriched)
				.where(
					and(
						eq(vw_lead_event_enriched.event_type, 'message_received'),
						eq(vw_lead_event_enriched.resolved_campaign_id, campaignId),
						gte(vw_lead_event_enriched.occurred_at, window.from),
						lt(vw_lead_event_enriched.occurred_at, window.toExclusive)
					)
				),
			db
				.select({ occurredAt: vw_lead_event_enriched.occurred_at })
				.from(vw_lead_event_enriched)
				.where(
					and(
						eq(vw_lead_event_enriched.event_type, 'booking_link_clicked'),
						eq(vw_lead_event_enriched.resolved_campaign_id, campaignId),
						gte(vw_lead_event_enriched.occurred_at, window.from),
						lt(vw_lead_event_enriched.occurred_at, window.toExclusive)
					)
				),
			db
				.select({ bookingUpdatedAt: vw_booking_enriched.booking_updated_at })
				.from(vw_booking_enriched)
				.where(
					and(
						eq(vw_booking_enriched.booking_status, 'confirmed'),
						eq(vw_booking_enriched.first_campaign_id, campaignId),
						gte(vw_booking_enriched.booking_updated_at, window.from),
						lt(vw_booking_enriched.booking_updated_at, window.toExclusive)
					)
				)
		]);

	const byDate = toCampaignDailyMap();
	const uniqueVisitorsByDate = new Map<string, Set<string>>();
	const identifiedJourneysByDate = new Map<string, Set<string>>();

	for (const row of visitRows) {
		if (!row.visitedAt) continue;
		const reportDate = toDateLabel(row.visitedAt, window.from);
		const acc = getCampaignDailyAccumulator(byDate, reportDate);
		acc.visits += 1;

		if (row.visitorIdentifier) {
			const existingVisitors = uniqueVisitorsByDate.get(reportDate);
			if (existingVisitors) {
				existingVisitors.add(row.visitorIdentifier);
			} else {
				uniqueVisitorsByDate.set(reportDate, new Set([row.visitorIdentifier]));
			}
		}
	}

	for (const row of journeyRows) {
		if (!row.journeyCreatedAt) continue;
		const reportDate = toDateLabel(row.journeyCreatedAt, window.from);
		const acc = getCampaignDailyAccumulator(byDate, reportDate);
		acc.journeysCreated += 1;
	}

	for (const row of identifiedRows) {
		if (!row.occurredAt || !row.journeyId) continue;
		const reportDate = toDateLabel(row.occurredAt, window.from);

		const existingJourneys = identifiedJourneysByDate.get(reportDate);
		if (existingJourneys) {
			existingJourneys.add(row.journeyId);
		} else {
			identifiedJourneysByDate.set(reportDate, new Set([row.journeyId]));
		}
	}

	for (const row of inboundRows) {
		if (!row.occurredAt) continue;
		const reportDate = toDateLabel(row.occurredAt, window.from);
		const acc = getCampaignDailyAccumulator(byDate, reportDate);
		acc.inboundMessages += 1;
	}

	for (const row of bookingClickRows) {
		if (!row.occurredAt) continue;
		const reportDate = toDateLabel(row.occurredAt, window.from);
		const acc = getCampaignDailyAccumulator(byDate, reportDate);
		acc.bookingLinkClicked += 1;
	}

	for (const row of bookingRows) {
		if (!row.bookingUpdatedAt) continue;
		const reportDate = toDateLabel(row.bookingUpdatedAt, window.from);
		const acc = getCampaignDailyAccumulator(byDate, reportDate);
		acc.bookingsCompleted += 1;
	}

	for (const [reportDate, visitors] of uniqueVisitorsByDate.entries()) {
		const acc = getCampaignDailyAccumulator(byDate, reportDate);
		acc.uniqueVisitors = visitors.size;
	}

	for (const [reportDate, journeys] of identifiedJourneysByDate.entries()) {
		const acc = getCampaignDailyAccumulator(byDate, reportDate);
		acc.identifiedLeads = journeys.size;
	}

	return [...byDate.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([reportDate, acc]) => ({
			reportDate,
			visits: acc.visits,
			uniqueVisitors: acc.uniqueVisitors,
			journeysCreated: acc.journeysCreated,
			identifiedLeads: acc.identifiedLeads,
			inboundMessages: acc.inboundMessages,
			bookingLinkClicked: acc.bookingLinkClicked,
			bookingsCompleted: acc.bookingsCompleted,
			visitToLeadRate: ratio(acc.identifiedLeads, acc.visits),
			leadToBookingRate: ratio(acc.bookingsCompleted, acc.identifiedLeads),
			visitToBookingRate: ratio(acc.bookingsCompleted, acc.visits)
		}));
}

export async function getDirectEmailFunnelDailyByCampaign(
	window: DateWindow,
	campaignId: number
): Promise<DirectEmailDailyPoint[]> {
	const [visitRows, ctaRows, inboundRows, bookingRows] = await Promise.all([
		db
			.select({ visitedAt: vw_visit_enriched.visited_at })
			.from(vw_visit_enriched)
			.where(
				and(
					eq(vw_visit_enriched.campaign_id, campaignId),
					gte(vw_visit_enriched.visited_at, window.from),
					lt(vw_visit_enriched.visited_at, window.toExclusive)
				)
			),
		db
			.select({
				occurredAt: vw_lead_event_enriched.occurred_at,
				eventPayload: vw_lead_event_enriched.event_payload
			})
			.from(vw_lead_event_enriched)
			.where(
				and(
					eq(vw_lead_event_enriched.event_type, 'cta_click'),
					eq(vw_lead_event_enriched.resolved_campaign_id, campaignId),
					gte(vw_lead_event_enriched.occurred_at, window.from),
					lt(vw_lead_event_enriched.occurred_at, window.toExclusive)
				)
			),
		db
			.select({
				occurredAt: vw_lead_event_enriched.occurred_at,
				eventPayload: vw_lead_event_enriched.event_payload
			})
			.from(vw_lead_event_enriched)
			.where(
				and(
					eq(vw_lead_event_enriched.event_type, 'message_received'),
					eq(vw_lead_event_enriched.resolved_campaign_id, campaignId),
					gte(vw_lead_event_enriched.occurred_at, window.from),
					lt(vw_lead_event_enriched.occurred_at, window.toExclusive)
				)
			),
		db
			.select({ bookingUpdatedAt: vw_booking_enriched.booking_updated_at })
			.from(vw_booking_enriched)
			.where(
				and(
					eq(vw_booking_enriched.booking_status, 'confirmed'),
					eq(vw_booking_enriched.first_touch_type, 'email'),
					eq(vw_booking_enriched.first_campaign_id, campaignId),
					gte(vw_booking_enriched.booking_updated_at, window.from),
					lt(vw_booking_enriched.booking_updated_at, window.toExclusive)
				)
			)
	]);

	const byDate = toDirectEmailDailyMap();

	for (const row of visitRows) {
		if (!row.visitedAt) continue;
		const reportDate = toDateLabel(row.visitedAt, window.from);
		const acc = getDirectEmailAccumulator(byDate, reportDate);
		acc.visits += 1;
	}

	for (const row of ctaRows) {
		if (!row.occurredAt) continue;
		const ctaType =
			typeof row.eventPayload === 'object' && row.eventPayload !== null
				? (row.eventPayload as Record<string, unknown>).cta_type
				: null;
		if (ctaType !== 'email') continue;

		const reportDate = toDateLabel(row.occurredAt, window.from);
		const acc = getDirectEmailAccumulator(byDate, reportDate);
		acc.directEmailCtaClicks += 1;
	}

	for (const row of inboundRows) {
		if (!row.occurredAt) continue;
		const attributionStatus =
			typeof row.eventPayload === 'object' && row.eventPayload !== null
				? (row.eventPayload as Record<string, unknown>).attribution_status
				: null;
		if (attributionStatus !== 'parsed') continue;

		const reportDate = toDateLabel(row.occurredAt, window.from);
		const acc = getDirectEmailAccumulator(byDate, reportDate);
		acc.aliasInboundMessages += 1;
	}

	for (const row of bookingRows) {
		if (!row.bookingUpdatedAt) continue;
		const reportDate = toDateLabel(row.bookingUpdatedAt, window.from);
		const acc = getDirectEmailAccumulator(byDate, reportDate);
		acc.emailFirstTouchBookings += 1;
	}

	return [...byDate.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([reportDate, acc]) => {
			const directEmailEntries = acc.directEmailCtaClicks + acc.aliasInboundMessages;

			return {
				reportDate,
				visits: acc.visits,
				directEmailCtaClicks: acc.directEmailCtaClicks,
				aliasInboundMessages: acc.aliasInboundMessages,
				directEmailEntries,
				emailFirstTouchBookings: acc.emailFirstTouchBookings,
				visitToDirectEmailRate: ratio(directEmailEntries, acc.visits),
				emailToBookingRate: ratio(acc.emailFirstTouchBookings, directEmailEntries)
			};
		});
}

export async function getCampaignConversionSummaryByCampaignId(
	campaignId: number
): Promise<CampaignConversionRow | null> {
	const [row] = await db
		.select()
		.from(vw_campaign_conversion_summary)
		.where(eq(vw_campaign_conversion_summary.campaign_id, campaignId))
		.limit(1);

	if (!row) {
		return null;
	}

	return {
		campaignId: row.campaign_id,
		campaignName: row.campaign_name,
		visitCampaignVisits: toNumber(row.visit_campaign_visits),
		journeyCampaignLeads: toNumber(row.journey_campaign_leads),
		firstTouchLeads: toNumber(row.first_touch_leads),
		firstTouchBookings: toNumber(row.first_touch_bookings),
		visitToJourneyLeadRate: row.visit_to_journey_lead_rate ?? 0,
		visitToFirstTouchLeadRate: row.visit_to_first_touch_lead_rate ?? 0,
		firstTouchLeadToBookingRate: row.first_touch_lead_to_booking_rate ?? 0,
		visitToFirstTouchBookingRate: row.visit_to_first_touch_booking_rate ?? 0
	};
}

export async function getSourceMediumPerformanceByCampaign(
	campaignId: number
): Promise<SourceMediumPerformanceRow[]> {
	const [visitRows, leadRows, bookingRows] = await Promise.all([
		db
			.select({
				utmSource: vw_visit_enriched.utm_source,
				utmMedium: vw_visit_enriched.utm_medium
			})
			.from(vw_visit_enriched)
			.where(eq(vw_visit_enriched.campaign_id, campaignId)),
		db
			.select({
				utmSource: vw_lead_journey_enriched.first_utm_source,
				utmMedium: vw_lead_journey_enriched.first_utm_medium
			})
			.from(vw_lead_journey_enriched)
			.where(eq(vw_lead_journey_enriched.first_campaign_id, campaignId)),
		db
			.select({
				utmSource: vw_booking_enriched.first_utm_source,
				utmMedium: vw_booking_enriched.first_utm_medium
			})
			.from(vw_booking_enriched)
			.where(
				and(
					eq(vw_booking_enriched.booking_status, 'confirmed'),
					eq(vw_booking_enriched.first_campaign_id, campaignId)
				)
			)
	]);

	const bySourceMedium = new Map<string, SourceMediumAccumulator>();

	for (const row of visitRows) {
		const key = sourceMediumKey(row.utmSource, row.utmMedium);
		const existing = bySourceMedium.get(key);

		if (existing) {
			existing.visitTouchVisits += 1;
			continue;
		}

		bySourceMedium.set(key, {
			utmSource: row.utmSource,
			utmMedium: row.utmMedium,
			visitTouchVisits: 1,
			firstTouchLeads: 0,
			firstTouchBookings: 0
		});
	}

	for (const row of leadRows) {
		const key = sourceMediumKey(row.utmSource, row.utmMedium);
		const existing = bySourceMedium.get(key);

		if (existing) {
			existing.firstTouchLeads += 1;
			continue;
		}

		bySourceMedium.set(key, {
			utmSource: row.utmSource,
			utmMedium: row.utmMedium,
			visitTouchVisits: 0,
			firstTouchLeads: 1,
			firstTouchBookings: 0
		});
	}

	for (const row of bookingRows) {
		const key = sourceMediumKey(row.utmSource, row.utmMedium);
		const existing = bySourceMedium.get(key);

		if (existing) {
			existing.firstTouchBookings += 1;
			continue;
		}

		bySourceMedium.set(key, {
			utmSource: row.utmSource,
			utmMedium: row.utmMedium,
			visitTouchVisits: 0,
			firstTouchLeads: 0,
			firstTouchBookings: 1
		});
	}

	return [...bySourceMedium.values()]
		.sort(
			(left, right) =>
				right.firstTouchBookings - left.firstTouchBookings ||
				right.firstTouchLeads - left.firstTouchLeads ||
				right.visitTouchVisits - left.visitTouchVisits
		)
		.slice(0, 50)
		.map((row) => ({
			utmSource: row.utmSource,
			utmMedium: row.utmMedium,
			visitTouchVisits: row.visitTouchVisits,
			firstTouchLeads: row.firstTouchLeads,
			firstTouchBookings: row.firstTouchBookings,
			visitToFirstTouchLeadRate: ratio(row.firstTouchLeads, row.visitTouchVisits),
			firstTouchLeadToBookingRate: ratio(row.firstTouchBookings, row.firstTouchLeads),
			visitToFirstTouchBookingRate: ratio(row.firstTouchBookings, row.visitTouchVisits)
		}));
}

export async function getCtaPerformanceByCampaign(
	campaignId: number
): Promise<CtaPerformanceRow[]> {
	const [clickRows, leadRows, bookingRows] = await Promise.all([
		db
			.select({
				ctaKey: vw_lead_event_enriched.cta_key,
				ctaLabel: vw_lead_event_enriched.cta_label,
				ctaSection: vw_lead_event_enriched.cta_section,
				ctaVariant: vw_lead_event_enriched.cta_variant
			})
			.from(vw_lead_event_enriched)
			.where(
				and(
					eq(vw_lead_event_enriched.event_type, 'cta_click'),
					eq(vw_lead_event_enriched.resolved_campaign_id, campaignId)
				)
			),
		db
			.select({ ctaKey: vw_lead_journey_enriched.first_cta_key })
			.from(vw_lead_journey_enriched)
			.where(eq(vw_lead_journey_enriched.first_campaign_id, campaignId)),
		db
			.select({ ctaKey: vw_booking_enriched.first_cta_key })
			.from(vw_booking_enriched)
			.where(
				and(
					eq(vw_booking_enriched.booking_status, 'confirmed'),
					eq(vw_booking_enriched.first_campaign_id, campaignId)
				)
			)
	]);

	const byCta = new Map<string, CtaAccumulator>();

	for (const row of clickRows) {
		if (!row.ctaKey) continue;

		const existing = byCta.get(row.ctaKey);
		if (existing) {
			existing.clicks += 1;
			existing.ctaLabel = existing.ctaLabel ?? row.ctaLabel;
			existing.ctaSection = existing.ctaSection ?? row.ctaSection;
			existing.ctaVariant = existing.ctaVariant ?? row.ctaVariant;
			continue;
		}

		byCta.set(row.ctaKey, {
			ctaKey: row.ctaKey,
			ctaLabel: row.ctaLabel,
			ctaSection: row.ctaSection,
			ctaVariant: row.ctaVariant,
			clicks: 1,
			firstTouchLeads: 0,
			firstTouchBookings: 0
		});
	}

	for (const row of leadRows) {
		if (!row.ctaKey) continue;

		const existing = byCta.get(row.ctaKey);
		if (existing) {
			existing.firstTouchLeads += 1;
			continue;
		}

		byCta.set(row.ctaKey, {
			ctaKey: row.ctaKey,
			ctaLabel: null,
			ctaSection: null,
			ctaVariant: null,
			clicks: 0,
			firstTouchLeads: 1,
			firstTouchBookings: 0
		});
	}

	for (const row of bookingRows) {
		if (!row.ctaKey) continue;

		const existing = byCta.get(row.ctaKey);
		if (existing) {
			existing.firstTouchBookings += 1;
			continue;
		}

		byCta.set(row.ctaKey, {
			ctaKey: row.ctaKey,
			ctaLabel: null,
			ctaSection: null,
			ctaVariant: null,
			clicks: 0,
			firstTouchLeads: 0,
			firstTouchBookings: 1
		});
	}

	return [...byCta.values()]
		.sort(
			(left, right) =>
				right.clicks - left.clicks || right.firstTouchBookings - left.firstTouchBookings
		)
		.slice(0, 50)
		.map((row) => ({
			ctaKey: row.ctaKey,
			ctaLabel: row.ctaLabel,
			ctaSection: row.ctaSection,
			ctaVariant: row.ctaVariant,
			clicks: row.clicks,
			firstTouchLeads: row.firstTouchLeads,
			firstTouchBookings: row.firstTouchBookings,
			clickToFirstTouchLeadRate: ratio(row.firstTouchLeads, row.clicks),
			clickToFirstTouchBookingRate: ratio(row.firstTouchBookings, row.clicks)
		}));
}
