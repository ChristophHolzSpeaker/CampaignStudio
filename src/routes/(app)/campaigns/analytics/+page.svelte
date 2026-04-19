<script lang="ts">
	import BarList from '$lib/components/analytics/BarList.svelte';
	import DataTable from '$lib/components/analytics/DataTable.svelte';
	import KpiCard from '$lib/components/analytics/KpiCard.svelte';
	import SectionPanel from '$lib/components/analytics/SectionPanel.svelte';
	import TrendChart from '$lib/components/analytics/TrendChart.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
	const percentFormatter = new Intl.NumberFormat('en-US', {
		style: 'percent',
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	});

	const formatCount = (value: number): string => integerFormatter.format(value);
	const formatPercent = (value: number): string => percentFormatter.format(value);
	const formatText = (value: string | null | undefined, fallback = '—'): string =>
		value?.trim() || fallback;
	const formatDateLabel = (value: string | Date): string => {
		if (typeof value === 'string') {
			return value;
		}

		if (!Number.isNaN(value.getTime())) {
			return value.toISOString().slice(0, 10);
		}

		return 'Invalid date';
	};

	const trendData = $derived.by(() =>
		data.funnelDaily.map((point) => ({
			label: formatDateLabel(point.reportDate),
			visits: point.visits,
			leads: point.identifiedLeads,
			bookings: point.bookingsCompleted,
			inboundMessages: point.inboundMessages
		}))
	);

	const inboundMessagesTotal = $derived.by(() =>
		data.funnelDaily.reduce((total, point) => total + point.inboundMessages, 0)
	);

	const campaignBarItems = $derived.by(() =>
		data.campaignSummary.slice(0, 6).map((row, index) => ({
			id: `campaign-${row.campaignId ?? index}`,
			label: formatText(row.campaignName, `Campaign #${row.campaignId ?? index + 1}`),
			value: row.firstTouchBookings,
			helpText: `${formatCount(row.firstTouchLeads)} first-touch leads`
		}))
	);

	const sourceBarItems = $derived.by(() =>
		data.sourceMediumPerformance.slice(0, 6).map((row, index) => ({
			id: `source-${index}`,
			label: `${formatText(row.utmSource, '(direct)')} / ${formatText(row.utmMedium, '(none)')}`,
			value: row.firstTouchBookings,
			helpText: `${formatCount(row.visitTouchVisits)} visits`
		}))
	);

	const campaignRows = $derived.by(() =>
		data.campaignSummary.map((row, index) => ({
			id: `campaign-table-${row.campaignId ?? index}`,
			values: [
				formatText(row.campaignName, `Campaign #${row.campaignId ?? index + 1}`),
				formatCount(row.visitCampaignVisits),
				formatCount(row.journeyCampaignLeads),
				formatCount(row.firstTouchLeads),
				formatCount(row.firstTouchBookings),
				formatPercent(row.visitToJourneyLeadRate),
				formatPercent(row.visitToFirstTouchLeadRate),
				formatPercent(row.firstTouchLeadToBookingRate),
				formatPercent(row.visitToFirstTouchBookingRate)
			]
		}))
	);

	const sourceRows = $derived.by(() =>
		data.sourceMediumPerformance.map((row, index) => ({
			id: `source-table-${index}`,
			values: [
				formatText(row.utmSource, '(direct)'),
				formatText(row.utmMedium, '(none)'),
				formatCount(row.visitTouchVisits),
				formatCount(row.firstTouchLeads),
				formatCount(row.firstTouchBookings),
				formatPercent(row.visitToFirstTouchLeadRate),
				formatPercent(row.firstTouchLeadToBookingRate),
				formatPercent(row.visitToFirstTouchBookingRate)
			]
		}))
	);

	const ctaRows = $derived.by(() =>
		data.ctaPerformance.map((row, index) => ({
			id: `cta-table-${row.ctaKey ?? index}`,
			values: [
				formatText(row.ctaKey),
				formatText(row.ctaLabel),
				formatText(row.ctaSection),
				formatText(row.ctaVariant),
				formatCount(row.clicks),
				formatCount(row.firstTouchLeads),
				formatCount(row.firstTouchBookings),
				formatPercent(row.clickToFirstTouchLeadRate),
				formatPercent(row.clickToFirstTouchBookingRate)
			]
		}))
	);
</script>

<svelte:head>
	<title>Campaign Studio • Analytics</title>
</svelte:head>

<section class="analytics-page">
	<header class="hero">
		<div>
			<p class="eyebrow">Campaigns › Analytics</p>
			<h1>Dashboard v1<span class="dot">.</span></h1>
			<p class="intro">
				Internal conversion and attribution snapshot built directly from KPI rollup views.
			</p>
		</div>
		<form method="GET" class="date-filter" aria-label="Date range filter for funnel and overview">
			<label>
				<span>From</span>
				<input type="date" name="from" value={data.dateRange.from} />
			</label>
			<label>
				<span>To</span>
				<input type="date" name="to" value={data.dateRange.to} />
			</label>
			<button type="submit" class="btn-dark">Apply</button>
		</form>
	</header>

	<SectionPanel
		title="Overview KPIs"
		description="Selected date range totals and conversion rates"
		scopeLabel={`${data.dateRange.from} to ${data.dateRange.to}`}
	>
		<div class="kpi-grid">
			<KpiCard label="Visits" value={formatCount(data.overview.visits)} />
			<KpiCard label="Unique visitors" value={formatCount(data.overview.uniqueVisitors)} />
			<KpiCard label="Inbound messages" value={formatCount(inboundMessagesTotal)} />
			<KpiCard label="Identified leads" value={formatCount(data.overview.identifiedLeads)} />
			<KpiCard label="Bookings completed" value={formatCount(data.overview.bookingsCompleted)} />
			<KpiCard label="Visit to lead rate" value={formatPercent(data.overview.visitToLeadRate)} />
			<KpiCard
				label="Lead to booking rate"
				value={formatPercent(data.overview.leadToBookingRate)}
			/>
			<KpiCard
				label="Visit to booking rate"
				value={formatPercent(data.overview.visitToBookingRate)}
			/>
		</div>
	</SectionPanel>

	<SectionPanel
		title="Funnel"
		description="Trend and selected-range funnel summary from vw_funnel_daily"
		scopeLabel={`${data.dateRange.from} to ${data.dateRange.to}`}
	>
		<div class="section-grid">
			<TrendChart data={trendData} />
			<article class="funnel-summary">
				<h3>Selected-range funnel summary</h3>
				<p class="funnel-meta">
					Direct email entries = tracked email CTA clicks + alias inbound emails (parsed
					plus-address)
				</p>
				<ul>
					<li><span>Visits</span><strong>{formatCount(data.overview.visits)}</strong></li>
					<li>
						<span>Inbound messages</span><strong>{formatCount(inboundMessagesTotal)}</strong>
					</li>
					<li>
						<span>Direct email entries</span><strong
							>{formatCount(data.directEmailSummary.directEmailEntries)}</strong
						>
					</li>
					<li>
						<span>Email first-touch bookings</span><strong
							>{formatCount(data.directEmailSummary.emailFirstTouchBookings)}</strong
						>
					</li>
					<li>
						<span>Identified leads</span><strong
							>{formatCount(data.overview.identifiedLeads)}</strong
						>
					</li>
					<li>
						<span>Bookings completed</span><strong
							>{formatCount(data.overview.bookingsCompleted)}</strong
						>
					</li>
					<li>
						<span>Visit → lead</span><strong>{formatPercent(data.overview.visitToLeadRate)}</strong>
					</li>
					<li>
						<span>Lead → booking</span><strong
							>{formatPercent(data.overview.leadToBookingRate)}</strong
						>
					</li>
					<li>
						<span>Visit → booking</span><strong
							>{formatPercent(data.overview.visitToBookingRate)}</strong
						>
					</li>
					<li>
						<span>Visit → Direct email</span><strong
							>{formatPercent(data.directEmailSummary.visitToDirectEmailRate)}</strong
						>
					</li>
					<li>
						<span>Email → Booking</span><strong
							>{formatPercent(data.directEmailSummary.emailToBookingRate)}</strong
						>
					</li>
				</ul>
			</article>
		</div>
	</SectionPanel>

	<SectionPanel
		title="Campaign performance"
		description="Campaign comparison from vw_campaign_conversion_summary"
		scopeLabel="All-time rollup"
	>
		<div class="section-grid">
			<BarList title="Top campaigns by first-touch bookings" items={campaignBarItems} />
			<DataTable
				columns={[
					'Campaign',
					'Visits',
					'Journey leads',
					'First-touch leads',
					'First-touch bookings',
					'Visit→Journey lead',
					'Visit→FT lead',
					'FT lead→booking',
					'Visit→FT booking'
				]}
				rows={campaignRows}
				rightAlignedColumns={[1, 2, 3, 4, 5, 6, 7, 8]}
				emptyLabel="No campaign rollup rows yet"
			/>
		</div>
	</SectionPanel>

	<SectionPanel
		title="Source / medium"
		description="Performance by source-medium from vw_source_medium_performance"
		scopeLabel="All-time rollup"
	>
		<div class="section-grid">
			<BarList title="Top source-medium by first-touch bookings" items={sourceBarItems} />
			<DataTable
				columns={[
					'Source',
					'Medium',
					'Visit-touch visits',
					'First-touch leads',
					'First-touch bookings',
					'Visit→FT lead',
					'FT lead→booking',
					'Visit→FT booking'
				]}
				rows={sourceRows}
				rightAlignedColumns={[2, 3, 4, 5, 6, 7]}
				emptyLabel="No source-medium rollup rows yet"
			/>
		</div>
	</SectionPanel>

	<SectionPanel
		title="CTA performance"
		description="CTA comparison from vw_cta_performance"
		scopeLabel="All-time rollup"
	>
		<DataTable
			columns={[
				'CTA key',
				'CTA label',
				'Section',
				'Variant',
				'Clicks',
				'First-touch leads',
				'First-touch bookings',
				'Click→FT lead',
				'Click→FT booking'
			]}
			rows={ctaRows}
			rightAlignedColumns={[4, 5, 6, 7, 8]}
			emptyLabel="No CTA rollup rows yet"
		/>
	</SectionPanel>
</section>

<style>
	.analytics-page {
		display: grid;
		gap: 1.25rem;
		padding: 1.5rem;
	}

	.hero {
		display: flex;
		justify-content: space-between;
		gap: 1.5rem;
		align-items: end;
		flex-wrap: wrap;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #5d3f3f;
	}

	h1 {
		margin: 0.2rem 0 0;
		font-size: clamp(2.1rem, 4.6vw, 3.4rem);
		letter-spacing: -0.03em;
	}

	.dot {
		color: var(--accent);
	}

	.intro {
		margin: 0.4rem 0 0;
		font-size: 0.9rem;
		color: #5d3f3f;
		max-width: 38rem;
	}

	.date-filter {
		display: flex;
		gap: 0.7rem;
		align-items: end;
		flex-wrap: wrap;
		background: #f3f3f3;
		padding: 0.7rem;
	}

	.date-filter label {
		display: grid;
		gap: 0.25rem;
	}

	.date-filter span {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #5d3f3f;
	}

	.date-filter input {
		background: #ffffff;
		padding: 0.45rem 0.55rem;
		border: 0;
	}

	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.75rem;
	}

	.section-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
	}

	.funnel-summary {
		background: #ffffff;
		padding: 1rem;
	}

	.funnel-summary h3 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
	}

	.funnel-meta {
		margin: 0 0 0.75rem;
		font-size: 0.71rem;
		color: #5d3f3f;
	}

	.funnel-summary ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}

	.funnel-summary li {
		display: flex;
		justify-content: space-between;
		gap: 0.7rem;
		font-size: 0.82rem;
	}

	.funnel-summary li span {
		color: #5d3f3f;
	}

	@media (min-width: 1300px) {
		.analytics-page {
			padding: 2rem;
		}

		.section-grid {
			grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1.5fr);
			align-items: start;
		}
	}
</style>
