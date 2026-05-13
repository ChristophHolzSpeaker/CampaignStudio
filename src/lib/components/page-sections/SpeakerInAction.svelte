<script lang="ts">
	import { page } from '$app/state';
	import { pushState } from '$app/navigation';
	import type { SpeakerInActionProps } from '$lib/page-builder/sections';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';

	let {
		props,
		campaignId = null,
		campaignPageId = null
	}: {
		props?: SpeakerInActionProps;
		campaignId?: number | null;
		campaignPageId?: number | null;
	} = $props();

	const sectionTitle = $derived(props?.title ?? 'The stage. Speaker in action.');
	const mediaAssets = $derived((props?.mediaAssets ?? []).slice(0, 4));

	const fallbackMediaAssets: SpeakerInActionProps['mediaAssets'] = [
		{
			assetId: 'speaker-in-action-fallback-1',
			title: 'Executive keynote stage reel',
			videoEmbedUrl: 'https://www.youtube.com/watch?v=mpbtCg2NSUs',
			thumbnailUrl: '/christoph-holz-speaker-slam-top-100-excellent-speakers-stage.webp',
			thumbnailAlt: 'Christoph Holz speaking on stage to an executive audience'
		},
		{
			assetId: 'speaker-in-action-fallback-2',
			title: 'Conference audience engagement highlight',
			videoEmbedUrl: 'https://www.youtube.com/watch?v=mpbtCg2NSUs',
			thumbnailUrl: '/christoph-holz-namaste-gesture-stage-nyc.webp',
			thumbnailAlt: 'Audience members reacting during a keynote talk'
		},
		{
			assetId: 'speaker-in-action-fallback-3',
			title: 'AI strategy keynote clip',
			videoEmbedUrl: 'https://www.youtube.com/watch?v=mpbtCg2NSUs',
			thumbnailUrl: '/christoph-holz-on-stage-engaging-cheering-audience-bow-tie.webp',
			thumbnailAlt: 'Speaker presenting AI strategy insights from stage'
		},
		{
			assetId: 'speaker-in-action-fallback-4',
			title: 'Leadership event showreel segment',
			videoEmbedUrl: 'https://www.youtube.com/watch?v=mpbtCg2NSUs',
			thumbnailUrl: '/christoph-holz-speaker-slam-stage-gesture-2019.webp',
			thumbnailAlt: 'Christoph Holz addressing a leadership event audience'
		}
	];

	const resolvedMediaAssets = $derived(
		mediaAssets.length >= 4 ? mediaAssets : fallbackMediaAssets.slice(0, 4)
	);
	const firstAsset = $derived(resolvedMediaAssets[0]);
	const secondAsset = $derived(resolvedMediaAssets[1]);
	const thirdAsset = $derived(resolvedMediaAssets[2]);
	const fourthAsset = $derived(resolvedMediaAssets[3]);

	function trackCta(variant: 'showreel_modal'): void {
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
				cta_key: 'speaker_in_action_video_cta',
				cta_label: 'View Showreel',
				cta_section: 'speaker_in_action',
				cta_variant: variant
			})
		}).catch(() => {
			// fire-and-forget tracking
		});
	}
	function openYouTubeModal(url: string) {
		trackCta('showreel_modal');

		pushState('', {
			...page.state,
			modal: {
				kind: 'youtube',
				url
			}
		});
	}
</script>

<section class="relative isolate overflow-hidden bg-surface px-6 py-16 sm:px-8 lg:px-12 lg:py-24">
	<SectionIdentifier props={{ id: 'speaker_in_action' }}></SectionIdentifier>
	<div class="mb-stack-lg mx-auto max-w-7xl px-8 pb-8">
		<h1 class=" text-center text-5xl leading-[0.95] font-bold tracking-tight lg:text-7xl">
			{sectionTitle}
		</h1>
	</div>
	<div class="grid h-150 grid-cols-2 gap-4 px-4 md:grid-cols-4">
		<div class="group relative col-span-2 row-span-2 overflow-hidden">
			<img
				class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
				alt={firstAsset.thumbnailAlt}
				src={firstAsset.thumbnailUrl}
			/>
			<button
				aria-label={`Play video: ${firstAsset.title}`}
				onclick={() => openYouTubeModal(firstAsset.videoEmbedUrl)}
				class="absolute inset-0 flex cursor-pointer items-end justify-end bg-primary/20 transition-opacity"
			>
				<span class="material-symbols--play-circle mr-10 mb-10 h-10 w-10 text-white"></span>
			</button>
		</div>
		<div class="group relative overflow-hidden">
			<img
				class="h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
				alt={secondAsset.thumbnailAlt}
				src={secondAsset.thumbnailUrl}
			/>
			<button
				aria-label={`Play video: ${secondAsset.title}`}
				onclick={() => openYouTubeModal(secondAsset.videoEmbedUrl)}
				class="absolute inset-0 flex cursor-pointer items-end justify-end bg-primary/20 transition-opacity"
			>
				<span class="material-symbols--play-circle mr-10 mb-10 h-10 w-10 text-white"></span>
			</button>
		</div>
		<div class="group relative overflow-hidden">
			<img
				class="h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
				alt={thirdAsset.thumbnailAlt}
				src={thirdAsset.thumbnailUrl}
			/>
			<button
				aria-label={`Play video: ${thirdAsset.title}`}
				onclick={() => openYouTubeModal(thirdAsset.videoEmbedUrl)}
				class="absolute inset-0 flex cursor-pointer items-end justify-end bg-primary/20 transition-opacity"
			>
				<span class="material-symbols--play-circle mr-10 mb-10 h-10 w-10 text-white"></span>
			</button>
		</div>
		<div class="group relative col-span-2 overflow-hidden">
			<img
				class="h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
				alt={fourthAsset.thumbnailAlt}
				src={fourthAsset.thumbnailUrl}
			/>
			<button
				aria-label={`Play video: ${fourthAsset.title}`}
				onclick={() => openYouTubeModal(fourthAsset.videoEmbedUrl)}
				class="absolute inset-0 flex cursor-pointer items-end justify-end bg-primary/20 transition-opacity"
			>
				<span class="material-symbols--play-circle mr-10 mb-10 h-10 w-10 text-white"></span>
			</button>
		</div>
	</div>
</section>

<style>
	.material-symbols--play-circle {
		display: inline-block;

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
