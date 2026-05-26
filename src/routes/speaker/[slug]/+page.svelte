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

<svelte:head>
	<!-- Google Tag Manager -->
	<script>
		(function (w, d, s, l, i) {
			w[l] = w[l] || [];
			w[l].push({
				'gtm.start': new Date().getTime(),
				event: 'gtm.js'
			});
			var f = d.getElementsByTagName(s)[0],
				j = d.createElement(s),
				dl = l != 'dataLayer' ? '&l=' + l : '';
			j.async = true;
			j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
			f.parentNode.insertBefore(j, f);
		})(window, document, 'script', 'dataLayer', 'GTM-NKXG7GN');
	</script>
	<!-- End Google Tag Manager -->
</svelte:head>

<!-- Google Tag Manager (noscript) -->
<noscript
	><iframe
		src="https://www.googletagmanager.com/ns.html?id=GTM-NKXG7GN"
		title="Google Tag Manager"
		height="0"
		width="0"
		style="display:none;visibility:hidden"
	></iframe></noscript
>
<!-- End Google Tag Manager (noscript) -->

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
