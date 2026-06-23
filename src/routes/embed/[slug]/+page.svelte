<script lang="ts">
	import { onMount } from 'svelte';
	import LandingNavigation from '$lib/components/blocks/LandingNavigation.svelte';
	import PageRenderer from '$lib/components/page-renderer/PageRenderer.svelte';
	import type { LandingPageDocument } from '$lib/page-builder/page';

	type BookingSlotGroups = Array<{
		dateKey: string;
		slots: Array<{ startsAtIso: string; endsAtIso: string }>;
	}>;

	let {
		data
	}: {
		data: {
			page: LandingPageDocument;
			slug?: string;
			campaignId: number | null;
			campaignPageId: number | null;
			jsonLd: string;
			speakerMailtoHref: string;
		};
	} = $props();

	let bookingSlotGroups = $state<BookingSlotGroups | undefined>(undefined);

	function measureEmbedHeight() {
		const { body, documentElement } = document;

		return Math.ceil(
			Math.max(
				body?.scrollHeight ?? 0,
				body?.offsetHeight ?? 0,
				body?.clientHeight ?? 0,
				documentElement?.scrollHeight ?? 0,
				documentElement?.offsetHeight ?? 0,
				documentElement?.clientHeight ?? 0
			)
		);
	}

	onMount(() => {
		if (window.parent === window) {
			return;
		}

		let animationFrame: number | undefined;
		const slug = data.slug ?? data.page.slug ?? '';

		function postEmbedHeight() {
			animationFrame = undefined;
			const height = measureEmbedHeight();

			try {
				window.parent.postMessage(
					{
						type: 'campaignstudio:embed-height',
						height,
						slug,
						campaignId: data.campaignId,
						campaignPageId: data.campaignPageId
					},
					'*'
				);
			} catch {
				// Ignore cross-window messaging errors so the embed can render standalone.
			}
		}

		function schedulePostEmbedHeight() {
			if (animationFrame !== undefined) {
				return;
			}

			animationFrame = window.requestAnimationFrame(postEmbedHeight);
		}

		const resizeObserver = new ResizeObserver(schedulePostEmbedHeight);
		resizeObserver.observe(document.body);

		window.addEventListener('load', schedulePostEmbedHeight);
		window.addEventListener('resize', schedulePostEmbedHeight);
		schedulePostEmbedHeight();

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('load', schedulePostEmbedHeight);
			window.removeEventListener('resize', schedulePostEmbedHeight);

			if (animationFrame !== undefined) {
				window.cancelAnimationFrame(animationFrame);
			}
		};
	});
</script>

<LandingNavigation
	mailto={data.speakerMailtoHref}
	campaignId={data.campaignId}
	campaignPageId={data.campaignPageId}
></LandingNavigation>
<PageRenderer
	page={data.page}
	campaignId={data.campaignId}
	campaignPageId={data.campaignPageId}
	mailtoHref={data.speakerMailtoHref}
	{bookingSlotGroups}
/>
