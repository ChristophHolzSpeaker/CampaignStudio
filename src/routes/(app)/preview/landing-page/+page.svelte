<script lang="ts">
	import PageRenderer from '$lib/components/page-renderer/PageRenderer.svelte';
	import type { LandingPageDocument } from '$lib/page-builder/page';

	let { data }: { data: { page: LandingPageDocument } } = $props();
	$inspect(data);
</script>

<PageRenderer page={data.page} />
