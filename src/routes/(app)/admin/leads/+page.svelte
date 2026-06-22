<script lang="ts">
	import KpiCard from '$lib/components/analytics/KpiCard.svelte';
	import SectionPanel from '$lib/components/analytics/SectionPanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	const countFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

	const formatCount = (value: number): string => countFormatter.format(value);
	const formatDateTime = (value: Date | string | null | undefined): string => {
		if (!value) return '—';
		const date = value instanceof Date ? value : new Date(value);
		return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
	};
	const formatText = (value: string | null | undefined, fallback = '—'): string =>
		value?.trim() || fallback;
	const formatShortBody = (value: string): string => {
		const normalized = value.trim().replace(/\s+/g, ' ');
		return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
	};

	const selectedJourneyId = $derived(data.selectedJourney?.id ?? null);
	const selectedJourney = $derived(data.selectedJourney ?? null);

	const timelineEntries = $derived.by(() => {
		if (!selectedJourney) return [];

		const messages = selectedJourney.messages.map((message) => ({
			id: `message-${message.id}`,
			type: 'message' as const,
			timestamp: message.timestamp,
			title: message.subject,
			headline: `${message.direction} · ${message.provider}`,
			meta: [message.fromEmail, message.toEmail, message.classification ?? 'unclassified'],
			body: formatShortBody(message.bodyText)
		}));

		const events = selectedJourney.events.map((event) => ({
			id: `event-${event.id}`,
			type: 'event' as const,
			timestamp: event.occurredAt,
			title: event.eventType,
			headline: `${event.eventSource} · ${formatText(event.resolvedCampaignName, 'Campaign unknown')}`,
			meta: [event.ctaKey, event.ctaLabel, event.ctaSection, event.ctaVariant].filter(
				(value): value is string => Boolean(value)
			),
			body: JSON.stringify(event.eventPayload, null, 2)
		}));

		return [...messages, ...events].sort(
			(left, right) => right.timestamp.getTime() - left.timestamp.getTime()
		);
	});

	const selectedJourneyHref = (journeyId: string): string => {
		const params = new URLSearchParams();
		if (data.filters.q) params.set('q', data.filters.q);
		if (data.filters.stage) params.set('stage', data.filters.stage);
		if (data.filters.campaign) params.set('campaign', String(data.filters.campaign));
		if (data.filters.openOnly) params.set('openOnly', 'true');
		params.set('journey', journeyId);
		return `?${params.toString()}`;
	};

	const applyFilterHref = (journeyId: string | null): string => {
		const params = new URLSearchParams();
		if (data.filters.q) params.set('q', data.filters.q);
		if (data.filters.stage) params.set('stage', data.filters.stage);
		if (data.filters.campaign) params.set('campaign', String(data.filters.campaign));
		if (data.filters.openOnly) params.set('openOnly', 'true');
		if (journeyId) params.set('journey', journeyId);
		return params.toString() ? `?${params.toString()}` : '?';
	};

	const openOnlyChecked = $derived(data.filters.openOnly);
</script>

<svelte:head>
	<title>Lead operations</title>
</svelte:head>

<section class="lead-page">
	<header class="hero">
		<div>
			<p class="eyebrow">Admin › Leads</p>
			<h1>Lead operations<span class="dot">.</span></h1>
			<p class="intro">
				Journey-first view of lead activity, messages, and events so you can see what is happening
				without cross-referencing tables.
			</p>
		</div>
		<div class="hero-meta">
			<span>{formatCount(data.summary.filteredJourneys)} visible</span>
			<span>{formatCount(data.summary.totalJourneys)} total journeys</span>
		</div>
	</header>

	<div class="kpi-grid">
		<KpiCard
			label="Open journeys"
			value={formatCount(data.summary.openJourneys)}
			helper="non-closed stages"
		/>
		<KpiCard
			label="Messages in 7 days"
			value={formatCount(data.summary.recentMessages)}
			helper="inbound and outbound"
		/>
		<KpiCard
			label="Events in 7 days"
			value={formatCount(data.summary.recentEvents)}
			helper="behavior and attribution"
		/>
		<KpiCard
			label="Auto-responses sent"
			value={formatCount(data.summary.autoResponsesSent)}
			helper="journey level"
		/>
	</div>

	<SectionPanel
		title="Filters"
		description="Search, narrow, and keep the selected journey in context."
		scopeLabel="Live"
	>
		<form method="GET" class="filters">
			<label>
				<span>Search</span>
				<input type="text" name="q" value={data.filters.q} placeholder="Email, name, stage, ID" />
			</label>
			<label>
				<span>Campaign</span>
				<select name="campaign">
					<option value="">All campaigns</option>
					{#each data.campaigns as campaign (campaign.id)}
						<option value={campaign.id} selected={data.filters.campaign === campaign.id}>
							{campaign.name}
						</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Stage</span>
				<select name="stage">
					<option value="">Any stage</option>
					{#each data.stageOptions as stage (stage)}
						<option value={stage} selected={data.filters.stage === stage}>{stage}</option>
					{/each}
				</select>
			</label>
			<label class="checkbox">
				<input type="checkbox" name="openOnly" checked={openOnlyChecked} />
				<span>Open only</span>
			</label>
			{#if selectedJourneyId}
				<input type="hidden" name="journey" value={selectedJourneyId} />
			{/if}
			<div class="filters-actions">
				<button type="submit" class="btn-dark">Apply</button>
				<a href={applyFilterHref(null)} class="btn-light">Reset</a>
			</div>
		</form>
	</SectionPanel>

	<div class="two-column-grid">
		<SectionPanel
			title="Journey queue"
			description="Recent journeys ordered by activity."
			scopeLabel={`${formatCount(data.journeys.length)} rows`}
		>
			{#if data.journeys.length === 0}
				<p class="empty">No journeys match the current filters.</p>
			{:else}
				<div class="table-shell">
					<table>
						<thead>
							<tr>
								<th>Lead</th>
								<th>Campaign</th>
								<th>Stage</th>
								<th>Msgs</th>
								<th>Events</th>
								<th>Latest activity</th>
							</tr>
						</thead>
						<tbody>
							{#each data.journeys as journey (journey.id)}
								<tr class:selected={journey.id === selectedJourneyId}>
									<td>
										<a href={selectedJourneyHref(journey.id)}>
											<strong
												>{formatText(
													journey.contactName,
													journey.contactEmail ?? journey.id
												)}</strong
											>
											<span>{formatText(journey.contactEmail, journey.id)}</span>
										</a>
									</td>
									<td>
										<strong
											>{formatText(
												journey.campaignName,
												`Campaign #${journey.campaignId ?? '—'}`
											)}</strong
										>
										<span>{formatText(journey.campaignPageSlug, 'No page slug')}</span>
									</td>
									<td>
										<span class={`stage stage-${journey.currentStage}`}>{journey.currentStage}</span
										>
										<span>{formatText(journey.outcome, 'No outcome')}</span>
									</td>
									<td>{formatCount(journey.messageCount)}</td>
									<td>{formatCount(journey.eventCount)}</td>
									<td>
										<strong>{formatDateTime(journey.latestActivityAt)}</strong>
										<span>{journey.latestActivityKind}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</SectionPanel>

		<SectionPanel
			title="Selected journey"
			description="Identity, attribution, and activity in one place."
			scopeLabel={selectedJourneyId ?? 'None selected'}
		>
			{#if selectedJourney}
				<div class="detail-stack">
					<div class="detail-grid">
						<div class="detail-card">
							<p>Contact</p>
							<strong>{formatText(selectedJourney.contactName, 'Unknown')}</strong>
							<span>{formatText(selectedJourney.contactEmail, 'No email')}</span>
						</div>
						<div class="detail-card">
							<p>Campaign</p>
							<strong
								>{formatText(
									selectedJourney.campaignName,
									`Campaign #${selectedJourney.campaignId ?? '—'}`
								)}</strong
							>
							<span>{formatText(selectedJourney.campaignPageSlug, 'No campaign page')}</span>
						</div>
						<div class="detail-card">
							<p>First touch</p>
							<strong>{selectedJourney.firstTouchType}</strong>
							<span>{formatDateTime(selectedJourney.firstTouchAt)}</span>
						</div>
						<div class="detail-card">
							<p>Last activity</p>
							<strong>{formatDateTime(selectedJourney.latestActivityAt)}</strong>
							<span>{selectedJourney.latestActivityKind}</span>
						</div>
					</div>

					<div class="meta-grid">
						<div>
							<p>Stage</p>
							<strong class={`stage stage-${selectedJourney.currentStage}`}
								>{selectedJourney.currentStage}</strong
							>
						</div>
						<div>
							<p>Outcome</p>
							<strong>{formatText(selectedJourney.outcome, 'Not set')}</strong>
						</div>
						<div>
							<p>HubSpot</p>
							<strong>{formatText(selectedJourney.hubspotContactId, 'Contact not linked')}</strong>
							<span>{formatText(selectedJourney.hubspotDealId, 'No deal')}</span>
						</div>
						<div>
							<p>Auto-response</p>
							<strong>{selectedJourney.autoResponseSentAt ? 'Sent' : 'Pending'}</strong>
							<span>{formatDateTime(selectedJourney.autoResponseSentAt)}</span>
						</div>
					</div>

					<div class="timeline-shell">
						<div class="timeline-header">
							<h3>Activity timeline</h3>
							<p>{formatCount(timelineEntries.length)} combined message and event entries</p>
						</div>

						{#if timelineEntries.length === 0}
							<p class="empty">No messages or events for this journey yet.</p>
						{:else}
							<ul class="timeline">
								{#each timelineEntries as entry (entry.id)}
									<li class:message={entry.type === 'message'} class:event={entry.type === 'event'}>
										<div class="timeline-marker"></div>
										<div class="timeline-card">
											<div class="timeline-top">
												<div>
													<p class="timeline-kind">{entry.type}</p>
													<h4>{entry.title}</h4>
													<p>{entry.headline}</p>
												</div>
												<time>{formatDateTime(entry.timestamp)}</time>
											</div>
											{#if entry.meta.length > 0}
												<div class="meta-pills">
													{#each entry.meta as item (item)}
														<span>{item}</span>
													{/each}
												</div>
											{/if}
											<pre>{entry.body}</pre>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{:else}
				<p class="empty">No journey selected.</p>
			{/if}
		</SectionPanel>
	</div>
</section>

<style>
	.lead-page {
		display: grid;
		gap: 1.25rem;
		padding: 1.5rem;
	}

	.hero {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
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
		max-width: 52rem;
		margin: 0.5rem 0 0;
		color: #5d3f3f;
	}

	.hero-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #5d3f3f;
	}

	.hero-meta span {
		background: #f3f3f3;
		padding: 0.5rem 0.7rem;
	}

	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
	}

	.filters {
		display: grid;
		grid-template-columns: 2fr 1.2fr 1fr auto auto;
		gap: 0.8rem;
		align-items: end;
	}

	.filters label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: #5d3f3f;
	}

	.filters input,
	.filters select {
		width: 100%;
		padding: 0.72rem 0.8rem;
		background: #fff;
		border: 1px solid rgba(93, 63, 63, 0.15);
	}

	.checkbox {
		grid-template-columns: auto 1fr;
		align-items: center;
		padding-bottom: 0.15rem;
	}

	.checkbox input {
		width: auto;
	}

	.filters-actions {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}

	.btn-dark,
	.btn-light {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		padding: 0.7rem 1rem;
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		white-space: nowrap;
	}

	.btn-dark {
		background: var(--accent);
		color: #fff;
		border: 0;
	}

	.btn-light {
		background: #fff;
		color: #402528;
		border: 1px solid rgba(93, 63, 63, 0.15);
	}

	.two-column-grid {
		display: grid;
		grid-template-columns: 1.15fr 0.85fr;
		gap: 1rem;
		align-items: start;
	}

	.empty {
		margin: 0;
		padding: 0.9rem;
		background: #fff;
		color: #5d3f3f;
	}

	.table-shell {
		overflow-x: auto;
		background: #fff;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 780px;
	}

	th,
	td {
		padding: 0.75rem;
		vertical-align: top;
		text-align: left;
		font-size: 0.8rem;
	}

	th {
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #5d3f3f;
		background: #f3f3f3;
	}

	tbody tr:nth-child(even) {
		background: #fafafa;
	}

	tbody tr.selected {
		background: rgba(184, 0, 42, 0.06);
	}

	td a {
		display: grid;
		gap: 0.2rem;
		color: inherit;
		text-decoration: none;
	}

	td span {
		display: block;
		color: #5d3f3f;
		font-size: 0.72rem;
	}

	.stage {
		display: inline-flex;
		align-items: center;
		padding: 0.18rem 0.45rem;
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: #f3f3f3;
		margin-bottom: 0.25rem;
	}

	.stage-closed,
	.stage-lost,
	.stage-cancelled,
	.stage-disqualified,
	.stage-archived {
		background: #f2d9dd;
	}

	.stage-won,
	.stage-confirmed {
		background: #e3efdf;
	}

	.detail-stack {
		display: grid;
		gap: 1rem;
	}

	.detail-grid,
	.meta-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.detail-card,
	.meta-grid > div {
		background: #fff;
		padding: 0.85rem;
		display: grid;
		gap: 0.25rem;
	}

	.detail-card p,
	.meta-grid p {
		margin: 0;
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #5d3f3f;
	}

	.detail-card strong,
	.meta-grid strong {
		font-size: 1rem;
	}

	.detail-card span,
	.meta-grid span {
		font-size: 0.75rem;
		color: #5d3f3f;
	}

	.timeline-shell {
		background: #f3f3f3;
		padding: 0.9rem;
		display: grid;
		gap: 0.9rem;
	}

	.timeline-header h3 {
		margin: 0;
		font-size: 1.05rem;
	}

	.timeline-header p {
		margin: 0.2rem 0 0;
		color: #5d3f3f;
		font-size: 0.8rem;
	}

	.timeline {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}

	.timeline li {
		display: grid;
		grid-template-columns: 12px minmax(0, 1fr);
		gap: 0.65rem;
		align-items: start;
	}

	.timeline-marker {
		width: 12px;
		height: 12px;
		margin-top: 0.65rem;
		background: #b8002a;
	}

	.timeline li.event .timeline-marker {
		background: #402528;
	}

	.timeline-card {
		background: #fff;
		padding: 0.85rem;
		display: grid;
		gap: 0.55rem;
	}

	.timeline-top {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
	}

	.timeline-kind {
		margin: 0;
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #5d3f3f;
	}

	.timeline-card h4 {
		margin: 0.15rem 0 0;
		font-size: 1rem;
	}

	.timeline-card p,
	.timeline-card time {
		margin: 0;
		font-size: 0.78rem;
		color: #5d3f3f;
	}

	.meta-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.meta-pills span {
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: #f3f3f3;
		padding: 0.2rem 0.35rem;
	}

	pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.75rem;
		line-height: 1.5;
		background: #fafafa;
		padding: 0.75rem;
	}

	@media (max-width: 1100px) {
		.kpi-grid,
		.two-column-grid,
		.filters,
		.detail-grid,
		.meta-grid {
			grid-template-columns: 1fr;
		}

		.filters-actions {
			justify-content: start;
		}
	}
</style>
