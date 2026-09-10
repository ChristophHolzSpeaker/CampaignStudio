<script lang="ts">
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';
	import { startSpeakerTracking } from '$lib/tracking/speaker-browser';
	import { provideSpeakerTracking } from '$lib/tracking/speaker-context';
	import LandingNavigation from '$lib/components/blocks/LandingNavigation.svelte';
	import ShallowRouteModal from '$lib/components/blocks/ShallowRouteModal.svelte';
	import YouTubeEmbed from '$lib/components/blocks/YouTubeEmbed.svelte';
	import PageRenderer from '$lib/components/page-renderer/PageRenderer.svelte';
	import { getSpeakerBookingSlotPreview } from './speaker-booking-slots.remote';
	import { logSpeakerVisit, markSpeakerVisitEngaged } from './speaker.remote';
	import type { LandingPageDocument } from '$lib/page-builder/page';
	import { browser } from '$app/environment';
	import type { SpeakerHeroMediaExperiment } from '$lib/server/ab-testing';

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
			abTest: SpeakerHeroMediaExperiment;
			speakerMailtoHref: string;
		};
	} = $props();

	const modal = $derived((page.state as App.PageState).modal);
	const ENGAGEMENT_THRESHOLD_MS = 10_000;

	let bookingSlotGroups = $state<BookingSlotGroups | undefined>(undefined);
	let bookingSlotsRequestId = 0;
	let loggedPageId: number | null = null;
	let tracking: ReturnType<typeof startSpeakerTracking> | undefined;
	provideSpeakerTracking({ measure: (event) => tracking?.measure(event) });
	let visitId = $state<number | null>(null);
	let visitVisitorIdentifier = $state<string | null>(null);
	let visitStartedAtMs: number | null = null;
	let engagementTimer: ReturnType<typeof setTimeout> | null = null;
	let engagementMarked = false;
	let isNavigationEngagementRequested = false;

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

		return () => {
			clearEngagementTimer();
			tracking?.stop();
			loggedPageId = null;
		};
	});

	// GTM containers cannot be unloaded on SPA navigation. Leave this document when
	// changing pages so a campaign's tags cannot keep running in another campaign or preview.
	beforeNavigate((navigation) => {
		const target = navigation.to?.url;
		if (
			!navigation.willUnload &&
			target &&
			(target.pathname !== page.url.pathname || target.search !== page.url.search)
		) {
			navigation.cancel();
			if (navigation.type === 'popstate') window.location.replace(target.href);
			else window.location.assign(target.href);
		}
	});

	afterNavigate(() => {
		void loadBookingSlots();
		void logVisit();
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

	function markVisitEngagedFromNavigation(): void {
		clearEngagementTimer();
		isNavigationEngagementRequested = true;
		void markVisitEngaged();
	}

	async function logVisit(): Promise<void> {
		if (loggedPageId === data.campaignPageId) {
			return;
		}

		const campaignId = data.campaignId;
		const campaignPageId = data.campaignPageId;
		const slug = page.params.slug;

		if (campaignId === null || campaignPageId === null || !slug) {
			return;
		}

		tracking?.stop();
		clearEngagementTimer();
		loggedPageId = campaignPageId;
		visitId = null;
		engagementMarked = false;
		isNavigationEngagementRequested = false;
		tracking = startSpeakerTracking(campaignId, campaignPageId, () => visitId);
		visitVisitorIdentifier = data.abTest.visitorId;
		visitStartedAtMs = performance.now();

		const result = await logSpeakerVisit({
			campaignId,
			campaignPageId,
			slug,
			visitorIdentifier: visitVisitorIdentifier,
			searchParams: Object.fromEntries(page.url.searchParams)
		});

		if (loggedPageId !== campaignPageId) return;
		if (result.visitId !== null) {
			visitId = result.visitId;
			if (isNavigationEngagementRequested) {
				void markVisitEngaged();
			} else {
				scheduleEngagementTimer();
			}
		}
	}
</script>

<svelte:head>
	<!-- prettier-ignore -->
	<script type="application/ld+json">
{data.jsonLd}
	</script>
</svelte:head>

<LandingNavigation
	mailto={data.speakerMailtoHref}
	campaignId={data.campaignId}
	campaignPageId={data.campaignPageId}
	campaignVisitId={visitId}
	anonymousId={visitVisitorIdentifier}
	onExternalNavigationClick={markVisitEngagedFromNavigation}
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
