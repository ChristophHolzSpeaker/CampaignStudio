<script lang="ts">
	type Props = {
		label: string;
		value: string;
		helper?: string;
	};

	let { label, value, helper }: Props = $props();
</script>

<article class="kpi-card">
	<p class="kpi-label">{label}</p>
	<p class="kpi-value">{value}</p>
	{#if helper}
		<p class="kpi-helper">{helper}</p>
	{/if}
</article>

<style>
	.kpi-card {
		background: #ffffff;
		padding: 1rem;
		display: grid;
		gap: 0.4rem;
	}

	.kpi-label {
		margin: 0;
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #5d3f3f;
	}

	.kpi-value {
		margin: 0;
		font-size: 2rem;
		line-height: 1;
	}

	.kpi-helper {
		margin: 0;
		font-size: 0.75rem;
		color: #5d3f3f;
	}
</style>
