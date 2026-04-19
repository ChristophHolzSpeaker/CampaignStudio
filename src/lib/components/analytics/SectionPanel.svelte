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
		background: #f3f3f3;
		padding: 1.25rem;
		display: grid;
		gap: 1rem;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}

	p {
		margin: 0;
		font-size: 0.85rem;
		color: #5d3f3f;
	}

	.scope-label {
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #5d3f3f;
		background: #ffffff;
		padding: 0.35rem 0.45rem;
	}
</style>
