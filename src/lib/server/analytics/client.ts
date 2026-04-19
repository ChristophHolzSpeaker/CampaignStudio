import { db } from '$lib/server/db';
import {
	vw_campaign_conversion_summary,
	vw_cta_performance,
	vw_direct_email_funnel_daily,
	vw_funnel_daily,
	vw_source_medium_performance
} from '$lib/server/db/schema';
import { and, asc, desc, gte, lt } from 'drizzle-orm';

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
