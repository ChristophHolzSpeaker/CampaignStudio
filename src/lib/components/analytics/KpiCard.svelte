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
		padding: 1rem 1.05rem;
		display: grid;
		gap: 0.4rem;
		border: 1px solid #e5e7eb;
		border-radius: 14px;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
		font-family: var(
			--analytics-font,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif
		);
	}

	.kpi-label {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0;
		color: #6b7280;
	}

	.kpi-value {
		margin: 0;
		font-size: 1.9rem;
		line-height: 1;
		font-weight: 650;
		color: #111827;
	}

	.kpi-helper {
		margin: 0;
		font-size: 0.75rem;
		color: #6b7280;
	}
</style>
