<script lang="ts">
	import type { HybridContentSectionProps } from '$lib/page-builder/sections/types';

	let { props }: { props?: HybridContentSectionProps } = $props();

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

<section
	class="bg-surface px-6 py-20 sm:px-8 lg:px-12 lg:py-28"
	aria-label="Hybrid Content section"
>
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
					<article class="flex h-full flex-col gap-4">
						<span>0{index + 1}</span>

						<img
							src={benefit.imageUrl ?? '/momentum.png'}
							alt={benefit.title}
							class="aspect-4/2 object-cover"
						/>
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

<section class="overflow-hidden bg-on-surface px-6 py-20 text-surface sm:px-8 lg:px-12 lg:py-28">
	<div class="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-16">
		<div>
			<h2 class="mb-10 text-4xl leading-[0.95] font-bold tracking-tight lg:text-6xl">
				{deepDiveTitle}
			</h2>
			{#if deepDiveItems.length > 0}
				<div class="space-y-10">
					{#each deepDiveItems as item, index (`hybrid-deep-dive-${item.title}`)}
						<div class="flex gap-4 sm:gap-6">
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
						src={primaryVisual.imageUrl}
						alt={primaryVisual.alt}
						class="relative z-10 h-full w-full object-cover grayscale"
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
