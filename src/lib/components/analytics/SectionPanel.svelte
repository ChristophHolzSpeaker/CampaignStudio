<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		description?: string;
		scopeLabel?: string;
		children?: Snippet;
	};

	let { title, description, scopeLabel, children }: Props = $props();
</script>

<section class="panel">
	<header class="panel-header">
		<div class="space-y-1">
			<h2>{title}</h2>
			{#if description}
				<p>{description}</p>
			{/if}
		</div>
		{#if scopeLabel}
			<span class="scope-label">{scopeLabel}</span>
		{/if}
	</header>
	<div class="panel-content">
		{@render children?.()}
	</div>
</section>

<style>
	.panel {
		background: #ffffff;
		padding: 1rem;
		display: grid;
		gap: 1rem;
		border: 1px solid #e5e7eb;
		border-radius: 18px;
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

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 650;
		letter-spacing: -0.01em;
		color: #111827;
	}

	p {
		margin: 0;
		font-size: 0.86rem;
		color: #6b7280;
	}

	.scope-label {
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #6b7280;
		background: #f9fafb;
		padding: 0.45rem 0.6rem;
		border-radius: 999px;
		border: 1px solid #e5e7eb;
	}
</style>
