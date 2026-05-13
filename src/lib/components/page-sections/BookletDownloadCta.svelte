<script lang="ts">
	import type { BookletDownloadCtaProps } from '$lib/page-builder/sections/types';
	import Button from '../elements/Button.svelte';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';

	let { props }: { props?: BookletDownloadCtaProps } = $props();
</script>

<section
	class="relative overflow-hidden bg-on-surface px-6 py-20 text-surface sm:px-8 lg:px-12 lg:py-28"
>
	<SectionIdentifier props={{ id: 'booklet_download_cta' }}></SectionIdentifier>
	<div class="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-16">
		<div class="relative">
			<div
				class="flex aspect-square items-center justify-center border border-surface/20 bg-surface/5 p-6"
			>
				<div class="absolute h-3/4 w-3/4 bg-primary/20 blur-3xl"></div>

				<img
					src="/christoph-holz-keynote-speaker-booklet-mockup.webp"
					alt="Christoph Holz Keynote Speaker Booklet"
					class="relative z-10 h-full w-full object-cover"
				/>
			</div>
		</div>
		<div>
			<div class="space-y-10">
				<div class="flex gap-4 sm:gap-6">
					<div>
						<span
							class="font-label-bold text-label-bold mb-6 inline-block bg-primary px-4 py-1 text-sm text-white"
						>
							{props?.labelText}
						</span>
						<h2 class="mb-10 text-4xl leading-[0.95] font-bold tracking-tight lg:text-7xl">
							{props?.heading}
						</h2>

						<p class="text-base leading-relaxed text-surface/75 lg:text-lg">
							{props?.paragraph}
						</p>
						<div class="mt-10">
							<Button>{props?.buttonCtaText}</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
