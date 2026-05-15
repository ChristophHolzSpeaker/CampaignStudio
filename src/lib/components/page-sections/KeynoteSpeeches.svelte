<script lang="ts">
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	type Keynote = {
		title: string;
		imageUrl: string;
		summary: string;
	};

	type KeynoteSpeechesSectionProps = {
		title: string;
		intro: string;
		keynotes: Keynote[];
	};

	let {
		props,
		disableScrollReveal = false
	}: { props: KeynoteSpeechesSectionProps; disableScrollReveal?: boolean } = $props();

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
</script>

<svelte:window bind:scrollY />
<section
	bind:this={sectionEl}
	class="relative bg-surface px-6 py-20 sm:px-8 lg:px-12 lg:py-28"
	aria-label="Hybrid Content section"
>
	<SectionIdentifier props={{ id: 'keynote_speeches' }}></SectionIdentifier>
	<div class="mx-auto max-w-7xl">
		<div class="mb-14 grid items-end gap-8 lg:mb-20 lg:grid-cols-12 lg:gap-12">
			<div class="space-y-6 lg:col-span-8">
				<h2 class="text-4xl leading-[0.95] font-bold tracking-tight text-on-surface lg:text-6xl">
					{props.title}
				</h2>
				<p class="max-w-3xl text-lg leading-relaxed text-on-surface/80 lg:text-2xl">
					{props.intro}
				</p>
			</div>
			<div class="lg:col-span-4 lg:flex lg:justify-end">
				<span class="block h-0.5 w-16 bg-primary"></span>
			</div>
		</div>

		{#if props.keynotes.length > 0}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each props.keynotes as keynote, index (`keynote-${keynote.title}`)}
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

						<img
							src={keynote.imageUrl ?? '/momentum.png'}
							alt={keynote.title}
							class="aspect-4/2 object-cover"
						/>
						<h3 class="text-3xl leading-tight font-bold tracking-tight text-on-surface">
							{keynote.title}
						</h3>
						<p class="text-base leading-relaxed text-on-surface/75">{keynote.summary}</p>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</section>
