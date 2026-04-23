<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import NavButton from '$lib/components/elements/NavButton.svelte';
	import type { ImmediateAuthorityHeroProps } from '$lib/page-builder/sections/types';

	let {
		props,
		campaignId = null,
		campaignPageId = null
	}: {
		props?: ImmediateAuthorityHeroProps;
		campaignId?: number | null;
		campaignPageId?: number | null;
	} = $props();

	const ctaHref = $derived(props?.primaryCtaHref ?? '#booking');
	const ctaLabel = $derived(props?.primaryCtaLabel ?? 'Request Speaking Availability');
	const eyebrow = $derived(props?.eyebrow ?? 'The Digital Future Authority');
	const headline = $derived(
		props?.headline ?? 'AI Keynote Speaker for Your Next Industry Association Conference.'
	);
	const subheadline = $derived(
		props?.subheadline ??
			'Deeply researched, actionable insights bridging the gap between technological possibility and operational reality.'
	);
	const videoEmbedUrl = $derived(props?.videoEmbedUrl ?? 'https://player.vimeo.com/video/76979871');
	const thumbnailUrl = $derived(
		props?.videoThumbnailUrl ??
			'https://cdn.prod.website-files.com/61263e0de406f497361dca55/6130408552ea140d707aab8e_christoph-contact-bg.jpg?auto=format&fit=crop&w=1400&q=80'
	);
	const thumbnailAlt = $derived(props?.videoThumbnailAlt ?? 'Christoph Holz on stage');
	const supportingBullets = $derived(props?.supportingBullets ?? []);

	function extractYouTubeVideoId(input: string): string | null {
		try {
			const parsed = new URL(input);
			const hostname = parsed.hostname.replace('www.', '');

			if (hostname === 'youtu.be') {
				return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
			}

			if (hostname.endsWith('youtube.com') || hostname.endsWith('youtube-nocookie.com')) {
				if (parsed.pathname === '/watch') {
					return parsed.searchParams.get('v');
				}

				if (parsed.pathname.startsWith('/embed/')) {
					return parsed.pathname.split('/').filter(Boolean)[1] ?? null;
				}
			}

			return null;
		} catch {
			return null;
		}
	}

	const isYouTubeUrl = $derived(!!extractYouTubeVideoId(videoEmbedUrl));

	function trackCta(variant: 'primary' | 'showreel_modal' | 'showreel_external'): void {
		if (campaignId == null || campaignPageId == null) {
			return;
		}

		void fetch('/api/attribution/cta', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				type: 'booking',
				campaign_id: campaignId,
				campaign_page_id: campaignPageId,
				cta_key: variant === 'primary' ? 'hero_primary_cta' : 'hero_showreel_cta',
				cta_label: variant === 'primary' ? ctaLabel : 'View Showreel',
				cta_section: 'immediate_authority_hero',
				cta_variant: variant
			})
		}).catch(() => {
			// fire-and-forget tracking
		});
	}

	function openYouTubeModal() {
		trackCta('showreel_modal');

		pushState('', {
			...page.state,
			modal: {
				kind: 'youtube',
				url: videoEmbedUrl
			}
		});
	}
</script>

<section
	class="relative isolate overflow-hidden bg-surface px-6 py-16 sm:px-8 lg:px-12 lg:py-24"
	aria-label="Immediate Authority Hero section"
>
	<div class="absolute inset-0 -z-20">
		<img class="h-full w-full object-cover grayscale" src={thumbnailUrl} alt={thumbnailAlt} />
	</div>
	<div
		class="absolute inset-0 -z-10 bg-linear-to-r from-surface via-surface/94 to-surface/82"
	></div>
	<div class="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-surface to-transparent"></div>

	<div class="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-12 lg:gap-12">
		<div class="space-y-7 lg:col-span-7">
			<span class="inline-block bg-primary px-3 py-1 text-[10px] tracking-[0.2em] text-white">
				{eyebrow}
			</span>
			<h1
				class="max-w-4xl text-5xl leading-[0.95] font-bold tracking-tight text-on-surface lg:text-7xl"
			>
				{headline}
			</h1>
			<p class="max-w-2xl text-base leading-relaxed text-on-surface/80 sm:text-lg lg:text-xl">
				{subheadline}
			</p>

			{#if supportingBullets.length > 0}
				<ul class="grid gap-2 text-sm text-on-surface/85 sm:grid-cols-2">
					{#each supportingBullets as bullet (`hero-bullet-${bullet}`)}
						<li class="flex items-start gap-2">
							<span aria-hidden="true" class="mt-[0.35rem] block h-1.5 w-1.5 bg-primary"></span>
							<span>{bullet}</span>
						</li>
					{/each}
				</ul>
			{/if}

			<div
				class="flex flex-col gap-3 sm:flex-row sm:items-center"
				data-cta-action={props?.primaryCtaAction}
			>
				<NavButton href={ctaHref} onclick={() => trackCta('primary')}>{ctaLabel}</NavButton>
				{#if isYouTubeUrl}
					<button
						type="button"
						class="outline-link relative inline-flex cursor-pointer items-center justify-center gap-2 px-6 py-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:opacity-80"
						onclick={openYouTubeModal}
					>
						<span class="material-symbols--play-circle"></span>
						View Showreel
					</button>
				{:else}
					<a
						class="outline-link relative inline-flex cursor-pointer items-center justify-center gap-2 px-6 py-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:opacity-80"
						href={videoEmbedUrl}
						target="_blank"
						rel="noreferrer"
						onclick={() => trackCta('showreel_external')}
					>
						<span class="material-symbols--play-circle"></span>
						View Showreel
					</a>
				{/if}
			</div>
		</div>

		<div class="relative lg:col-span-5">
			<div class="aspect-4/5 overflow-hidden bg-surface-container-lowest">
				<img
					src={thumbnailUrl}
					alt={thumbnailAlt}
					class="h-full w-full object-cover grayscale transition-all duration-500 hover:grayscale-0"
				/>
			</div>
			<div class="absolute -right-6 -bottom-6 -z-10 h-28 w-28 bg-primary/20 blur-3xl"></div>
		</div>
	</div>
</section>

<style>
	.material-symbols--play-circle {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='m9.5 16.5l7-4.5l-7-4.5zM12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
