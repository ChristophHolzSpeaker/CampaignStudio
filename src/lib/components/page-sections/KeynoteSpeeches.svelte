<script lang="ts">
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

	let { props }: { props: KeynoteSpeechesSectionProps } = $props();
</script>

<section
	class="bg-surface px-6 py-20 sm:px-8 lg:px-12 lg:py-28"
	aria-label="Hybrid Content section"
>
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
						class={['relative flex h-full flex-col gap-4 transition-all duration-500 ease-out']}
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
