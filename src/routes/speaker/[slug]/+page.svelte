<script lang="ts">
	import { page } from '$app/state';
	import LandingNavigation from '$lib/components/blocks/LandingNavigation.svelte';
	import ShallowRouteModal from '$lib/components/blocks/ShallowRouteModal.svelte';
	import YouTubeEmbed from '$lib/components/blocks/YouTubeEmbed.svelte';
	import PageRenderer from '$lib/components/page-renderer/PageRenderer.svelte';
	import LeadBookingPage from '../../book/l/[token]/+page.svelte';
	import type { LandingPageDocument } from '$lib/page-builder/page';
	import type { PageData } from './$types';

	let {
		data
	}: {
		data: {
			page: LandingPageDocument;
			campaignId: number | null;
			campaignPageId: number | null;
			speakerMailtoHref: string;
			bookingSlotGroups: PageData['bookingSlotGroups'];
		};
	} = $props();

	const modal = $derived((page.state as App.PageState).modal);
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
	bookingSlotGroups={data.bookingSlotGroups}
/>

{#if modal?.kind === 'youtube'}
	<ShallowRouteModal title="Showreel" onclose={() => history.back()}>
		<YouTubeEmbed url={modal.url} />
	</ShallowRouteModal>
{/if}

{#if modal?.kind === 'booking'}
	<ShallowRouteModal title="Schedule a Call" onclose={() => history.back()}>
		<LeadBookingPage
			data={modal.data as import('../../book/l/[token]/$types').PageData}
			form={null}
		/>
	</ShallowRouteModal>
{/if}
