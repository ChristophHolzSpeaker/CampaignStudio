<script lang="ts">
	import PageRenderer from '$lib/components/page-renderer/PageRenderer.svelte';
	import type { LandingPageDocument } from '$lib/page-builder/page';

	let { data }: { data: { page: LandingPageDocument } } = $props();
</script>

<svelte:head>
	<title>{data.page.title} | Preview</title>
</svelte:head>

<PageRenderer page={data.page} />
