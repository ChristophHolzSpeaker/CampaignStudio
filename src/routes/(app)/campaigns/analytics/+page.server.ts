import type { PageServerLoad } from './$types';
import {
	buildDirectEmailSummary,
	buildOverviewKpis,
	getCampaignConversionSummary,
	getCtaPerformance,
	getDirectEmailFunnelDaily,
	getFunnelDaily,
	getSourceMediumPerformance
} from '$lib/server/analytics/client';

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

export const load: PageServerLoad = async ({ url }) => {
	const dateWindow = resolveDateWindow(url);

	const [funnelDaily, directEmailDaily, campaignSummary, sourceMediumPerformance, ctaPerformance] =
		await Promise.all([
			getFunnelDaily({ from: dateWindow.from, toExclusive: dateWindow.toExclusive }),
			getDirectEmailFunnelDaily({ from: dateWindow.from, toExclusive: dateWindow.toExclusive }),
			getCampaignConversionSummary(),
			getSourceMediumPerformance(),
			getCtaPerformance()
		]);

	const overview = buildOverviewKpis(funnelDaily);
	const directEmailSummary = buildDirectEmailSummary(directEmailDaily);

	return {
		dateRange: {
			from: dateWindow.fromInput,
			to: dateWindow.toInput
		},
		overview,
		funnelDaily,
		directEmailDaily,
		directEmailSummary,
		campaignSummary,
		sourceMediumPerformance,
		ctaPerformance
	};
};
