<script lang="ts">
	import type { SeoProps } from '$lib/page-builder/sections/types';

	let { props }: { props?: SeoProps } = $props();

	let title = $derived(props?.title?.trim() ?? '');
	let description = $derived(props?.description?.trim() ?? '');
	let canonicalUrl = $derived(props?.canonicalUrl?.trim());
	let robots = $derived(props?.robots?.trim() ?? 'index,follow');
	let ogType = $derived(props?.ogType ?? 'website');
	let ogImageUrl = $derived(props?.ogImageUrl?.trim());
	let ogImageAlt = $derived(props?.ogImageAlt?.trim());
	let twitterCard = $derived(props?.twitterCard ?? 'summary_large_image');
	let twitterSite = $derived(props?.twitterSite?.trim());
</script>

<svelte:head>
	{#if title}
		<title>{title}</title>
		<meta property="og:title" content={title} />
		<meta name="twitter:title" content={title} />
	{/if}

	{#if description}
		<meta name="description" content={description} />
		<meta property="og:description" content={description} />
		<meta name="twitter:description" content={description} />
	{/if}

	{#if canonicalUrl}
		<link rel="canonical" href={canonicalUrl} />
		<meta property="og:url" content={canonicalUrl} />
	{/if}

	<meta name="robots" content={robots} />
	<meta property="og:type" content={ogType} />
	<meta name="twitter:card" content={twitterCard} />

	{#if ogImageUrl}
		<meta property="og:image" content={ogImageUrl} />
		<meta name="twitter:image" content={ogImageUrl} />
	{/if}

	{#if ogImageAlt}
		<meta property="og:image:alt" content={ogImageAlt} />
		<meta name="twitter:image:alt" content={ogImageAlt} />
	{/if}

	{#if twitterSite}
		<meta name="twitter:site" content={twitterSite} />
	{/if}
</svelte:head>
