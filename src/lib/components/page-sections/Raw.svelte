<script lang="ts">
	import type { RawProps } from '$lib/page-builder/sections';

	let { props }: { props: RawProps } = $props();
</script>

<svelte:head>
	<svelte:element this={'style'}>{props.tailwindCss ?? ''}</svelte:element>
</svelte:head>

<section id={props.id}>
	{@html props.html}
</section>
