<script lang="ts">
	const { campaign } = $props();

	const badges = $derived.by(() =>
		[
			{ label: campaign?.audience ?? '', tone: 'muted' },
			{ label: campaign?.format ?? '', tone: 'muted' },
			{
				label: campaign?.status ?? '',
				tone: campaign?.status === 'published' ? 'accent' : 'muted'
			}
		].filter((badge) => badge.label)
	);

	const snippet = $derived.by(() => {
		const notes = (campaign?.notes ?? '').trim();
		if (!notes.length) return '';
		return notes.length > 140 ? `${notes.slice(0, 140)}…` : notes;
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
</script>

<article class="campaign-card">
	<div class="card-head">
		<p class="purpose" aria-label="campaign topic">{campaign?.topic ?? 'Campaign'}</p>
		<div class="badge-row">
			{#each badges as badge (badge.label)}
				<span class={`badge ${badge.tone ?? ''}`}>{badge.label}</span>
			{/each}
		</div>
	</div>

	<h3>{campaign?.name}</h3>
	<p class="meta">
		{campaign?.created_by ? `By ${campaign.created_by}` : ''}
		{campaign?.created_by && campaign?.created_at ? ' · ' : ''}
		{formatDate(campaign?.created_at)}
	</p>

	{#if snippet}
		<p class="snippet">{snippet}</p>
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
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.4rem 0.85rem;
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

	.campaign-card {
		background: #ffffff;
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

	h3 {
		margin: 0;
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		font-size: 1.25rem;
		text-transform: uppercase;
	}

	.meta {
		margin: 0;
		font-size: 0.9rem;
		color: #5d3f3f;
	}

	.snippet {
		margin: 0;
		color: #1a1c1c;
		font-family: 'Bureau Grot', sans-serif;
		line-height: 1.6;
	}
</style>
