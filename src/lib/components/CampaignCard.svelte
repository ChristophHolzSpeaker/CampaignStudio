<script lang="ts">
	import type { CampaignRecordWithMetrics } from '$lib/server/campaigns/client';

	const { campaign }: { campaign?: CampaignRecordWithMetrics | null | undefined } = $props();

	const badges = $derived.by(() =>
		[
			{ label: campaign?.audience ?? '', tone: 'muted' },
			{ label: campaign?.format ?? '', tone: 'muted' },
			{ label: campaign?.language ?? '', tone: 'muted' },
			{ label: campaign?.geography ?? '', tone: 'muted' }
		].filter((badge) => badge.label)
	);

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

<td class="px-6 py-2">
	<div class="flex items-center gap-4">
		<a href="/campaigns/{campaign?.id}">
			<div class="font-headline-md text-sm font-bold text-gray-900 uppercase">
				{campaign?.name}
			</div>
			<div class="font-body-sm mt-1 text-xs text-secondary">Campaign ID: {campaign?.id}</div>
		</a>
	</div>
</td>
<td class="px-6 py-2 text-center">
	<div class="badge-row">
		<span class={`badge ${campaign?.status ?? ''}`}>{campaign?.status}</span>
	</div>
</td>
<td class="px-6 py-2 text-xs">
	<div class="flex flex-col gap-1">
		{creatorLabel ? `By ${creatorLabel}` : ''}
		{creatorLabel && campaign?.created_at ? ' · ' : ''}
		{formatDate(campaign?.created_at)}
	</div>
</td>
<td class="px-6 py-2 text-right text-xs">
	Visits {visitDisplay.totalVisits}
	· Unique {visitDisplay.uniqueVisitors}
	{#if visitDisplay.lastVisitedAt}
		· Last visit {formatDate(visitDisplay.lastVisitedAt)}
	{/if}
</td>

<style>
	.campaign-card {
		padding: 0.5rem;
		border-radius: 0;
		border: 0;
	}

	.campaign-main {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 2rem;
	}

	.campaign-left {
		min-width: 0;
		flex: 1.2;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.campaign-right {
		min-width: 18rem;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.75rem;
		text-align: right;
	}

	.campaign-title {
		margin: 0;
		font-size: 2.25rem;
		line-height: 0.95;
		text-transform: uppercase;
	}

	.campaign-stats {
		color: #876868;
	}

	.right-badges {
		justify-content: flex-end;
	}

	.snippet {
		margin: 0;
		max-width: 32rem;
		border-radius: 2px;
		background: #f5f5f4;
		padding: 0.75rem;
		color: #57534e;
		font-style: italic;
		line-height: 1.5;
	}

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
		background: #dddcdc;
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

	.badge.archived {
		background: #9ca3af;
		color: #fff;
	}

	.meta {
		margin: 0;
		font-size: 0.9rem;
		color: #5d3f3f;
	}

	@media (max-width: 768px) {
		.campaign-main {
			flex-direction: column;
			gap: 1.25rem;
		}

		.campaign-right {
			width: 100%;
			min-width: 0;
			align-items: flex-start;
			text-align: left;
		}

		.right-badges {
			justify-content: flex-start;
		}

		.snippet {
			max-width: none;
		}
	}

	a {
		font-family: 'Bureau Grot', sans-serif;
		font-weight: 500;
		text-transform: uppercase;
		font-stretch: condensed;
		letter-spacing: -0.02em;
	}
</style>
