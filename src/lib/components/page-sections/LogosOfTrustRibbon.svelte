<script lang="ts">
	import type { LogosOfTrustRibbonProps } from '$lib/page-builder/sections/types';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';

	let { props }: { props?: LogosOfTrustRibbonProps } = $props();

	const fallbackLogos = [
		{
			name: 'Redbull',
			imageUrl: '/redbull-logo-svgrepo-com.svg',
			alt: 'Redbull'
		},
		{
			name: 'Google',
			imageUrl: '/68231e19a6b5c7afb9fdbf99_Google_2015_logo.svg.webp',
			alt: 'Google'
		},
		{
			name: 'Atos',
			imageUrl: '/68231e18e79c638d8f3661bb_Atos.svg',
			alt: 'Atos'
		},
		{
			name: 'BMW Group',
			imageUrl: '/68231e4f2fdb78ace3f120ee_BMW_Group.svg',
			alt: 'BMW Group'
		}
	] as const;

	const label = $derived(props?.label ?? 'Trusted in executive and innovation contexts');
	const title = $derived(props?.title);
	const logos = $derived(props?.logos?.length ? props.logos : fallbackLogos);
</script>

<section
	class="relative bg-[#435a9f] px-6 py-12 sm:px-8"
	aria-label="Logos of Trust Ribbon section"
>
	<SectionIdentifier props={{ id: 'logos_of_trust_ribbon' }}></SectionIdentifier>
	<div class="mx-auto max-w-7xl">
		<div
			class="grid grid-cols-2 items-center justify-center justify-items-center gap-x-8 gap-y-8 lg:flex lg:gap-x-12"
		>
			{#each logos as logo (logo.name)}
				<div class="flex min-h-20 w-full max-w-60 items-center justify-center">
					{#if logo.imageUrl}
						<img
							src={logo.imageUrl}
							alt={logo.alt}
							class="h-auto max-h-8 w-auto object-contain brightness-0 grayscale invert sm:max-h-10"
						/>
					{:else}
						<span class="text-center text-base tracking-tight text-on-surface">{logo.name}</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>
