<script>
	const { badges = [] } = $props();
</script>

<div class="badge-row">
	{#each badges as badge}
		<span class={`badge ${badge.tone ?? ''}`}>{badge.label}</span>
	{/each}
</div>

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
</style>
