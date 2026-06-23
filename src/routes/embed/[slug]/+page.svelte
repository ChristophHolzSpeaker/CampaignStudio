<script lang="ts">
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
			campaignId: number | null;
			campaignPageId: number | null;
			jsonLd: string;
			speakerMailtoHref: string;
		};
	} = $props();

	let bookingSlotGroups = $state<BookingSlotGroups | undefined>(undefined);
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
