<script lang="ts">
	import MarkdownText from '$lib/components/elements/MarkdownText.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Campaign Documentation</title>
</svelte:head>

<section class="documentation-content space-y-8 p-6 lg:p-10">
	<div class="space-y-2">
		<p class="text-[0.7rem] tracking-[0.28em] text-[#777] uppercase">Admin › Documentation</p>
		<h1 class="text-[3rem] tracking-[-0.03em]">
			Campaign User Journey<span class="text-[var(--accent)]">.</span>
		</h1>
		<p class="max-w-[44rem] text-[0.95rem] text-[#5d3f3f]">
			Route-by-route operational reference for Campaign Studio. Use this as source material for
			journey diagrams and team onboarding.
		</p>
	</div>

	<article class="doc-shell">
		<MarkdownText content={data.markdown} />
	</article>
</section>

<style>
	.documentation-content {
		min-width: 0;
	}

	.doc-shell {
		background: #ffffff;
		padding: 1.5rem;
	}
</style>
