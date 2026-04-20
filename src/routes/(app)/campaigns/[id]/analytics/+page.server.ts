import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	buildDirectEmailSummary,
	buildOverviewKpis,
	getCampaignConversionSummaryByCampaignId,
	getCtaPerformanceByCampaign,
	getDirectEmailFunnelDailyByCampaign,
	getFunnelDailyByCampaign,
	getSourceMediumPerformanceByCampaign
} from '$lib/server/analytics/client';
import { getCampaignById } from '$lib/server/campaigns/client';
import { db } from '$lib/server/db';
import { campaign_pages } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DateWindowMeta = {
	from: Date;
	toExclusive: Date;
	fromInput: string;
	toInput: string;
};

function startOfUtcDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateInput(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function parseDateInput(value: string | null): Date | null {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return null;
	}

	const parsed = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed;
}

function resolveDateWindow(url: URL, defaultDays = 30): DateWindowMeta {
	const todayUtc = startOfUtcDay(new Date());
	const defaultTo = todayUtc;
	const defaultFrom = new Date(defaultTo.getTime() - (defaultDays - 1) * MS_PER_DAY);

	const fromCandidate = parseDateInput(url.searchParams.get('from'));
	const toCandidate = parseDateInput(url.searchParams.get('to'));

	let from = fromCandidate ?? defaultFrom;
	let toInclusive = toCandidate ?? defaultTo;

	if (from.getTime() > toInclusive.getTime()) {
		from = defaultFrom;
		toInclusive = defaultTo;
	}

	const toExclusive = new Date(toInclusive.getTime() + MS_PER_DAY);

	return {
		from,
		toExclusive,
		fromInput: formatDateInput(from),
		toInput: formatDateInput(toInclusive)
	};
}

export const load: PageServerLoad = async ({ params, url }) => {
	const campaignId = Number(params.id);

	if (!Number.isFinite(campaignId) || campaignId <= 0) {
		throw error(400, 'Invalid campaign id');
	}

	const campaign = await getCampaignById(campaignId);
	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	const dateWindow = resolveDateWindow(url);

	const [
		funnelDaily,
		directEmailDaily,
		campaignSummaryRow,
		sourceMediumPerformance,
		ctaPerformance
	] = await Promise.all([
		getFunnelDailyByCampaign(
			{ from: dateWindow.from, toExclusive: dateWindow.toExclusive },
			campaignId
		),
		getDirectEmailFunnelDailyByCampaign(
			{ from: dateWindow.from, toExclusive: dateWindow.toExclusive },
			campaignId
		),
		getCampaignConversionSummaryByCampaignId(campaignId),
		getSourceMediumPerformanceByCampaign(campaignId),
		getCtaPerformanceByCampaign(campaignId)
	]);

	const overview = buildOverviewKpis(funnelDaily);
	const directEmailSummary = buildDirectEmailSummary(directEmailDaily);

	const [latestCampaignPage] = await db
		.select({ id: campaign_pages.id })
		.from(campaign_pages)
		.where(eq(campaign_pages.campaign_id, campaignId))
		.orderBy(desc(campaign_pages.version_number))
		.limit(1);

	return {
		campaign,
		campaignPageId: latestCampaignPage?.id ?? null,
		dateRange: {
			from: dateWindow.fromInput,
			to: dateWindow.toInput
		},
		overview,
		funnelDaily,
		directEmailDaily,
		directEmailSummary,
		campaignSummary: campaignSummaryRow ? [campaignSummaryRow] : [],
		sourceMediumPerformance,
		ctaPerformance
	};
};
