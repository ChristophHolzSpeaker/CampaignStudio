<script lang="ts">
	import type { CampaignRecordWithMetrics } from '$lib/server/campaigns/client';

	const { campaign }: { campaign?: CampaignRecordWithMetrics | null | undefined } = $props();

	const badges = $derived.by(() =>
		[
			{ label: campaign?.audience ?? '', tone: 'muted' },
			{ label: campaign?.format ?? '', tone: 'muted' },
			{ label: campaign?.language ?? '', tone: 'muted' },
			{ label: campaign?.geography ?? '', tone: 'muted' },
			{
				label: campaign?.status ?? '',
				tone: campaign?.status === 'published' ? 'published' : 'draft'
			}
		].filter((badge) => badge.label)
	);

	const snippet = $derived.by(() => {
		const notes = (campaign?.notes ?? '').trim();
		if (!notes.length) return '';
		return notes.length > 140 ? `${notes.slice(0, 140)}…` : notes;
	});

	const visitDisplay = $derived.by(() => {
		const withMetrics = campaign as Partial<CampaignRecordWithMetrics> | null | undefined;
		const totalVisits = typeof withMetrics?.visitCount === 'number' ? withMetrics.visitCount : 0;
		const uniqueVisitors =
			typeof withMetrics?.uniqueVisitorCount === 'number' ? withMetrics.uniqueVisitorCount : 0;
		const lastVisitedAt = withMetrics?.lastVisitedAt ?? null;

		return {
			totalVisits,
			uniqueVisitors,
			lastVisitedAt
		};
	});

	const formatDate = (value?: Date | string | null) => {
		if (!value) return '';
		const date = new Date(value);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	};

	const creatorLabel = $derived.by(() => {
		if (!campaign?.created_by) return '';
		return campaign.created_by_display_name?.trim() || campaign.created_by;
	});
</script>

<article class="campaign-card">
	<div class="card-head">
		<p class="purpose" aria-label="campaign topic">{campaign?.topic ?? 'Campaign'}</p>
	</div>
	<h3 class="text-4xl uppercase">{campaign?.name}</h3>
	<p class="meta">
		{creatorLabel ? `By ${creatorLabel}` : ''}
		{creatorLabel && campaign?.created_at ? ' · ' : ''}
		{formatDate(campaign?.created_at)}
	</p>
	<p class="meta meta-secondary">
		Visits {visitDisplay.totalVisits}
		· Unique {visitDisplay.uniqueVisitors}
		{#if visitDisplay.lastVisitedAt}
			· Last visit {formatDate(visitDisplay.lastVisitedAt)}
		{/if}
	</p>
	<div class="badge-row">
		{#each badges as badge (badge.label)}
			<span class={`badge ${badge.tone ?? ''}`}>{badge.label}</span>
		{/each}
	</div>

	{#if snippet}
		<p class=" rounded-xs bg-stone-100 p-3 text-stone-600 italic">{snippet}</p>
	{/if}
</article>

<style>
	.badge-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.badge {
		font-family: 'Bureau Grot', 'Space Grotesk', sans-serif;
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.2rem 0.4rem;
		background: #ffffff;
		color: #5d3f3f;
		border-radius: 0;
		border: 0;
	}

	.badge.accent {
		background: linear-gradient(135deg, #b8002a, #e2183b);
		color: #ffffff;
		letter-spacing: 0.1em;
	}

	.badge.muted {
		background: #f3f3f3;
		color: #5d3f3f;
	}

	.badge.published {
		background: #4ade80;
		color: #fff;
	}

	.badge.draft {
		background: #38bdf8;
		color: #fff;
	}

	.campaign-card {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border-radius: 0;
		border: 0;
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.purpose {
		font-family: 'Bureau Grot', 'Space Grotesk', sans-serif;
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #b8002a;
		margin: 0;
	}

	.meta {
		margin: 0;
		font-size: 0.9rem;
		color: #5d3f3f;
	}

	.meta-secondary {
		font-size: 0.8rem;
		color: #876868;
		margin-top: -0.5rem;
	}

	.snippet {
		margin: 0;
		color: #1a1c1c;
		font-family: 'Bureau Grot', sans-serif;
		line-height: 1.6;
	}
</style>
