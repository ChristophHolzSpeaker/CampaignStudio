<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';
	import LandingNavigation from '$lib/components/blocks/LandingNavigation.svelte';
	import ShallowRouteModal from '$lib/components/blocks/ShallowRouteModal.svelte';
	import YouTubeEmbed from '$lib/components/blocks/YouTubeEmbed.svelte';
	import PageRenderer from '$lib/components/page-renderer/PageRenderer.svelte';
	import { getSpeakerBookingSlotPreview } from './speaker-booking-slots.remote';
	import { logSpeakerVisit, markSpeakerVisitEngaged } from './speaker.remote';
	import type { LandingPageDocument } from '$lib/page-builder/page';
	import { browser } from '$app/environment';
	import type { SpeakerPrimaryCtaAbTest } from '$lib/server/ab-testing';

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
			abTest: SpeakerPrimaryCtaAbTest;
			speakerMailtoHref: string;
		};
	} = $props();

	const modal = $derived((page.state as App.PageState).modal);
	const VISITOR_IDENTIFIER_KEY = 'cs_vid';
	const ENGAGEMENT_THRESHOLD_MS = 10_000;

	let bookingSlotGroups = $state<BookingSlotGroups | undefined>(undefined);
	let bookingSlotsRequestId = 0;
	let visitLogged = false;
	let visitId: number | null = null;
	let visitVisitorIdentifier: string | null = null;
	let visitStartedAtMs: number | null = null;
	let engagementTimer: ReturnType<typeof setTimeout> | null = null;
	let engagementMarked = false;

	function getVisitorIdentifier(): string {
		try {
			const existing = localStorage.getItem(VISITOR_IDENTIFIER_KEY);
			if (existing) {
				return existing;
			}

			const created = crypto.randomUUID();
			localStorage.setItem(VISITOR_IDENTIFIER_KEY, created);
			return created;
		} catch {
			return crypto.randomUUID();
		}
	}

	async function loadBookingSlots(): Promise<void> {
		const requestId = ++bookingSlotsRequestId;
		bookingSlotGroups = undefined;

		try {
			const preview = await getSpeakerBookingSlotPreview();
			if (requestId !== bookingSlotsRequestId) {
				return;
			}

			bookingSlotGroups = preview.slotGroups;
		} catch (error) {
			if (requestId !== bookingSlotsRequestId) {
				return;
			}

			console.error('Speaker booking slot preview failed', error);
			bookingSlotGroups = [];
		}
	}

	onMount(() => {
		if (browser) {
			document.documentElement.lang = 'de';
		}

		injectAnalytics();
		void loadBookingSlots();
		void logVisit();
		afterNavigate(() => {
			void loadBookingSlots();
			void logVisit();
		});

		return () => {
			clearEngagementTimer();
		};
	});

	function clearEngagementTimer(): void {
		if (engagementTimer === null) {
			return;
		}

		clearTimeout(engagementTimer);
		engagementTimer = null;
	}

	function scheduleEngagementTimer(): void {
		clearEngagementTimer();
		engagementTimer = setTimeout(() => {
			engagementTimer = null;
			void markVisitEngaged();
		}, ENGAGEMENT_THRESHOLD_MS);
	}

	async function markVisitEngaged(): Promise<void> {
		if (engagementMarked || visitId === null || visitVisitorIdentifier === null) {
			return;
		}

		engagementMarked = true;

		const durationMs = Math.max(
			0,
			Math.round(performance.now() - (visitStartedAtMs ?? performance.now()))
		);

		await markSpeakerVisitEngaged({
			visitId,
			visitorIdentifier: visitVisitorIdentifier,
			durationMs
		});
	}

	async function logVisit(): Promise<void> {
		if (visitLogged) {
			return;
		}

		const campaignId = data.campaignId;
		const campaignPageId = data.campaignPageId;
		const slug = page.params.slug;

		if (campaignId === null || campaignPageId === null || !slug) {
			return;
		}

		visitLogged = true;
		visitVisitorIdentifier = getVisitorIdentifier();
		visitStartedAtMs = performance.now();

		const result = await logSpeakerVisit({
			campaignId,
			campaignPageId,
			slug,
			visitorIdentifier: visitVisitorIdentifier,
			searchParams: Object.fromEntries(page.url.searchParams)
		});

		if (result.visitId !== null) {
			visitId = result.visitId;
			scheduleEngagementTimer();
		}
	}
</script>

<svelte:head>
	<!-- Google Tag Manager -->
	<script>
		(function (w, d, s, l, i) {
			w[l] = w[l] || [];
			w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
			var f = d.getElementsByTagName(s)[0],
				j = d.createElement(s),
				dl = l != 'dataLayer' ? '&l=' + l : '';
			j.async = true;
			j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
			f.parentNode.insertBefore(j, f);
		})(window, document, 'script', 'dataLayer', 'GTM-MCDDK28B');
	</script>
	<!-- End Google Tag Manager -->
	<!-- prettier-ignore -->
	<script type="application/ld+json">
{data.jsonLd}
	</script>
</svelte:head>

<!-- Google Tag Manager (noscript) -->
<noscript
	><iframe
		src="https://www.googletagmanager.com/ns.html?id=GTM-MCDDK28B"
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
	abTest={data.abTest}
	{bookingSlotGroups}
/>

{#if modal?.kind === 'youtube'}
	<ShallowRouteModal title="Showreel" onclose={() => history.back()}>
		<YouTubeEmbed url={modal.url} />
	</ShallowRouteModal>
{/if}

{#if modal?.kind === 'booking'}
	<ShallowRouteModal title="Schedule a Call" onclose={() => history.back()}>
		{#await import('../../book/l/[token]/+page.svelte') then { default: LeadBookingPage }}
			<LeadBookingPage
				data={modal.data as import('../../book/l/[token]/$types').PageData}
				form={null}
			/>
		{/await}
	</ShallowRouteModal>
{/if}
