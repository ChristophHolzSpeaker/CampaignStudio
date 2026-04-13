<script lang="ts">
	import type { LogosOfTrustRibbonProps } from '$lib/page-builder/sections/types';

	let { props }: { props?: LogosOfTrustRibbonProps } = $props();

	const fallbackLogos = [
		{
			name: 'Executive Summits',
			imageUrl: 'https://dummyimage.com/260x90/f3f3f3/1a1c1c.png&text=Executive+Summits',
			alt: 'Executive Summits wordmark placeholder'
		},
		{
			name: 'Innovation Forums',
			imageUrl: 'https://dummyimage.com/260x90/f3f3f3/1a1c1c.png&text=Innovation+Forums',
			alt: 'Innovation Forums wordmark placeholder'
		},
		{
			name: 'Corporate Offsites',
			imageUrl: 'https://dummyimage.com/260x90/f3f3f3/1a1c1c.png&text=Corporate+Offsites',
			alt: 'Corporate Offsites wordmark placeholder'
		},
		{
			name: 'Global Tech Expo',
			imageUrl: 'https://dummyimage.com/260x90/f3f3f3/1a1c1c.png&text=Global+Tech+Expo',
			alt: 'Global Tech Expo wordmark placeholder'
		}
	] as const;

	const label = $derived(props?.label ?? 'Trusted in executive and innovation contexts');
	const title = $derived(props?.title);
	const logos = $derived(props?.logos?.length ? props.logos : fallbackLogos);
</script>

<section
	class="bg-surface-container-low px-6 py-12 sm:px-8"
	aria-label="Logos of Trust Ribbon section"
>
	<div class="mx-auto max-w-7xl">
		{#if title}
			<p class="mb-3 text-center text-sm tracking-[0.08em] text-on-surface">{title}</p>
		{/if}
		<p class="mb-8 text-center text-[11px] tracking-[0.2em] text-on-surface/70 sm:mb-10 sm:text-xs">
			{label}
		</p>

		<div
			class="grid grid-cols-2 items-center justify-items-center gap-x-8 gap-y-8 opacity-70 grayscale lg:grid-cols-4 lg:gap-x-12"
		>
			{#each logos as logo (logo.name)}
				<div class="flex min-h-20 w-full max-w-60 items-center justify-center">
					{#if logo.imageUrl}
						<img
							src={logo.imageUrl}
							alt={logo.alt}
							class="h-auto max-h-12 w-auto object-contain sm:max-h-20"
						/>
					{:else}
						<span class="text-center text-base tracking-tight text-on-surface">{logo.name}</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>
