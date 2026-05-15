<script lang="ts">
	import type { HybridContentSectionProps } from '$lib/page-builder/sections/types';
	import { SvelteSet } from 'svelte/reactivity';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';
	import DirectAccess from './DirectAccess.svelte';

	let {
		props,
		mailtoHref = 'mailto:speaker@christophholz.com',
		campaignId = null,
		campaignPageId = null,
		disableScrollReveal = false
	}: {
		props?: HybridContentSectionProps;
		mailtoHref?: string;
		campaignId?: number | null;
		campaignPageId?: number | null;
		disableScrollReveal?: boolean;
	} = $props();
	let scrollY = $state(0);
	let innerHeight = $state(0);
	let sectionEl = $state<HTMLElement | null>(null);
	let visibleItems = new SvelteSet<number>();
	const revealOffset = 600;

	$effect(() => {
		if (disableScrollReveal) {
			return;
		}

		scrollY;
		innerHeight;

		const revealItems = sectionEl?.querySelectorAll<HTMLElement>('[data-reveal-index]') ?? [];
		for (const el of revealItems) {
			const index = Number(el.dataset.revealIndex);
			if (Number.isNaN(index) || visibleItems.has(index)) continue;

			const rect = el.getBoundingClientRect();
			const isInView = rect.top < innerHeight + revealOffset && rect.bottom > 0;

			if (isInView) {
				visibleItems.add(index);
			}
		}
	});

	const title = $derived(props?.title ?? 'Bridging the AI-Workforce Gap');
	const intro = $derived(
		props?.intro ??
			'This section clarifies what your audience will leave with from this format and topic, then shows why Christoph is uniquely qualified to deliver those outcomes.'
	);
	const deepDiveTitle = $derived(props?.deepDiveTitle ?? 'Why Christoph');
	const benefits = $derived(props?.benefits ?? []);
	const deepDiveItems = $derived(props?.deepDiveItems ?? []);
	const primaryVisual = $derived(props?.supportingVisualItems?.[0]);
</script>

<svelte:window bind:scrollY />
<section
	bind:this={sectionEl}
	class="bg-surface-container relative px-6 py-20 sm:px-8 lg:px-12 lg:py-28"
	aria-label="Hybrid Content section"
>
	<SectionIdentifier props={{ id: 'hybrid_content_section' }}></SectionIdentifier>
	<div class="mx-auto max-w-7xl">
		<div class="mb-14 grid items-end gap-8 lg:mb-20 lg:grid-cols-12 lg:gap-12">
			<div class="space-y-6 lg:col-span-8">
				<h2 class="text-4xl leading-[0.95] font-bold tracking-tight text-on-surface lg:text-6xl">
					{title}
				</h2>
				<p class="max-w-3xl text-lg leading-relaxed text-on-surface/80 lg:text-2xl">{intro}</p>
			</div>
			<div class="lg:col-span-4 lg:flex lg:justify-end">
				<span class="block h-0.5 w-16 bg-primary"></span>
			</div>
		</div>

		{#if benefits.length > 0}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each benefits as benefit, index (`hybrid-benefit-${benefit.title}`)}
					<article
						data-reveal-index={index}
						class={[
							'relative flex h-full flex-col gap-4 transition-all duration-500 ease-out',
							disableScrollReveal || visibleItems.has(index)
								? 'translate-y-0 opacity-100'
								: 'translate-y-8 opacity-0'
						]}
						style={`transition-delay: ${index * 120}ms`}
					>
						<span>0{index + 1}</span>

						<!--<img
							src={benefit.imageUrl ?? '/momentum.png'}
							alt={benefit.title}
							class="aspect-4/2 object-cover"
						/>-->
						<h3 class="text-3xl leading-tight font-bold tracking-tight text-on-surface">
							{benefit.title}
						</h3>
						<p class="text-base leading-relaxed text-on-surface/75">{benefit.body}</p>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</section>

<section class="overflow-hidden bg-on-surface px-6 pt-20 text-surface sm:px-8 lg:px-12 lg:pt-28">
	<div class="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-16">
		<div>
			<h2 class="mb-10 text-4xl leading-[0.95] font-bold tracking-tight lg:text-6xl">
				{deepDiveTitle}
			</h2>
			{#if deepDiveItems.length > 0}
				<div class="space-y-10">
					{#each deepDiveItems as item, index (`hybrid-deep-dive-${item.title}`)}
						<div
							data-reveal-index={index + benefits.length}
							class={[
								'flex gap-4 transition-all duration-500 ease-out sm:gap-6',
								disableScrollReveal || visibleItems.has(index + benefits.length)
									? 'translate-y-0 opacity-100'
									: 'translate-y-8 opacity-0'
							]}
							style={`transition-delay: ${index * 120}ms`}
						>
							<span class="text-lg text-primary">{`0${index + 1}`}</span>
							<div>
								<h4 class="mb-2 text-2xl leading-tight font-bold tracking-tight">{item.title}</h4>
								<p class="text-base leading-relaxed text-surface/75 lg:text-lg">{item.body}</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="relative">
			<div
				class="flex aspect-square items-center justify-center border border-surface/20 bg-surface/5 p-6"
			>
				<div class="absolute h-3/4 w-3/4 bg-primary/20 blur-3xl"></div>
				{#if primaryVisual}
					<img
						src="https://tiuljkhdhhmvscujnslz.supabase.co/storage/v1/object/public/campaign-assets/christoph-holz-portrait-smiling-red-bowtie.webp"
						alt={primaryVisual.alt}
						class="relative z-10 h-full w-full object-cover"
					/>
				{:else}
					<div class="relative z-10 p-10 text-center">
						<span class="material-symbols-outlined mb-4 text-7xl text-primary">hub</span>
						<p class="text-sm tracking-[0.2em] text-primary">Neural Network Analysis</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

<DirectAccess
	props={{ mailtoHref, emailCtaTitle: props?.emailCtaTitle }}
	{campaignId}
	{campaignPageId}
></DirectAccess>
