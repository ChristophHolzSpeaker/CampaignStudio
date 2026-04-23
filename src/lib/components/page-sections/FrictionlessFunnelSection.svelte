<script lang="ts">
	import Button from '$lib/components/elements/Button.svelte';
	import Input from '$lib/components/elements/Input.svelte';
	import TextArea from '$lib/components/elements/TextArea.svelte';
	import { preloadData, pushState, goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { FrictionlessFunnelBookingProps } from '$lib/page-builder/sections/types';
	import { submitBookingRequest } from './FrictionlessFunnelSection.remote';
	import type { CTAType } from '../../../../shared/event-types';

	let {
		props,
		campaignId = null,
		campaignPageId = null
	}: {
		props?: FrictionlessFunnelBookingProps;
		campaignId?: number | null;
		campaignPageId?: number | null;
	} = $props();

	let hasTrackedFormStart = $state(false);
	let isOpeningBookingModal = $state(false);

	function trackCta(type: CTAType, leadJourneyId?: string): void {
		if (campaignId == null || campaignPageId == null) {
			return;
		}

		void fetch('/api/attribution/cta', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				type,
				campaign_id: campaignId,
				campaign_page_id: campaignPageId,
				...(leadJourneyId ? { lead_journey_id: leadJourneyId } : {})
			})
		}).catch(() => {
			// fire-and-forget tracking
		});
	}

	function trackFormStarted(): void {
		if (hasTrackedFormStart || campaignId == null || campaignPageId == null) {
			return;
		}

		hasTrackedFormStart = true;

		void fetch('/api/attribution/form-start', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				campaign_id: campaignId,
				campaign_page_id: campaignPageId,
				page_path: pageSlug,
				form_key: 'frictionless_booking_request'
			})
		}).catch(() => {
			// fire-and-forget tracking
		});
	}

	function handleFormInput(event: Event): void {
		submitBookingRequest.validate();

		if (hasTrackedFormStart) {
			return;
		}

		const target = event.target;
		if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
			return;
		}

		if (target.value.trim().length === 0) {
			return;
		}

		trackFormStarted();
	}

	const title = $derived(props?.title ?? 'Tell us about your event goals');
	const description = $derived(
		props?.description ??
			'Share your audience, timeline, and desired outcomes. We will follow up with fit and next steps.'
	);
	const primaryCtaLabel = $derived(props?.primaryCtaLabel ?? 'Start Booking Request');
	const trustNote = $derived(props?.trustNote);
	const formDisclaimer = $derived(props?.formDisclaimer);
	const pageSlug = $derived(page.url.pathname);
	const leadJourneyId = $derived.by(() => {
		const result = submitBookingRequest.result as { leadJourneyId?: string } | undefined;
		return result?.leadJourneyId;
	});

	// Check if we have valid campaign context for the booking modal
	const canOpenBookingModal = $derived(
		campaignId != null && campaignId > 0 && campaignPageId != null && campaignPageId > 0
	);

	async function openBookingModal(): Promise<void> {
		if (!canOpenBookingModal || isOpeningBookingModal) {
			return;
		}

		isOpeningBookingModal = true;

		try {
			const utmParams = new URLSearchParams();
			utmParams.set('utm_source', 'frictionless_funnel');
			utmParams.set('utm_campaignId', String(campaignId));
			utmParams.set('utm_campaignPageId', String(campaignPageId));
			utmParams.set('utm_pageSlug', pageSlug);

			const href = `/book/l/new?${utmParams.toString()}`;

			// Preload the route data
			const result = await preloadData(href);

			if (result.type === 'loaded' && result.status === 200) {
				pushState(href, {
					...page.state,
					modal: { kind: 'booking', data: result.data }
				});
			} else if (result.type === 'redirect') {
				// Campaign validation failed, go to general booking
				goto(result.location);
			} else {
				// Fallback: navigate normally
				goto(href);
			}

			trackCta('booking', leadJourneyId);
		} finally {
			isOpeningBookingModal = false;
		}
	}

	const fullNameError = $derived(submitBookingRequest.fields?.fullName?.issues()?.[0]?.message);
	const organizationError = $derived(
		submitBookingRequest.fields?.organization?.issues()?.[0]?.message
	);
	const emailError = $derived(submitBookingRequest.fields?.email?.issues()?.[0]?.message);
	const eventDetailsError = $derived(
		submitBookingRequest.fields?.eventDetails?.issues()?.[0]?.message
	);
</script>

<section
	id="booking"
	class="bg-surface-container px-6 py-20 sm:px-8 lg:px-12 lg:py-28"
	aria-label="Frictionless Funnel Booking section"
>
	<div class="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-16">
		<div class="space-y-8">
			<h2 class="text-4xl leading-[0.95] font-bold tracking-tight text-on-surface lg:text-6xl">
				{title}
			</h2>
			<p class="max-w-xl text-lg leading-relaxed text-on-surface/75">{description}</p>

			{#if canOpenBookingModal}
				<button
					type="button"
					class="outline-link relative inline-flex cursor-pointer items-center justify-center gap-2 py-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:opacity-80"
					onclick={openBookingModal}
					disabled={isOpeningBookingModal}
				>
					<span class="mdi--calendar-edit"></span>
					{isOpeningBookingModal ? 'Loading...' : 'Prefer direct scheduling'}
				</button>
			{/if}
		</div>

		<div class="border-outline/20 bg-surface p-4 lg:p-10">
			<form
				{...submitBookingRequest}
				class="space-y-6"
				oninput={handleFormInput}
				onsubmit={() => trackCta('form')}
			>
				<input type="hidden" name="campaignId" value={campaignId ?? ''} />
				<input type="hidden" name="campaignPageId" value={campaignPageId ?? ''} />
				<input type="hidden" name="pageSlug" value={pageSlug} />

				{#if submitBookingRequest.result?.message}
					<p
						class={`px-4 py-3 text-xs tracking-[0.14em] uppercase ${submitBookingRequest.result.success ? 'bg-primary/10 text-primary' : 'bg-on-surface/8 text-on-surface'}`}
					>
						{submitBookingRequest.result.message}
					</p>
				{/if}

				<Input
					id="booking-full-name"
					label="Full Name"
					placeholder="John Doe"
					error={fullNameError}
					{...submitBookingRequest.fields.fullName.as('text')}
				/>

				<Input
					id="booking-organization"
					label="Organization"
					placeholder="Company or association"
					error={organizationError}
					{...submitBookingRequest.fields.organization.as('text')}
				/>

				<Input
					id="booking-email"
					label="Email Address"
					placeholder="name@organization.com"
					error={emailError}
					{...submitBookingRequest.fields.email.as('email')}
				/>

				<TextArea
					id="booking-event-details"
					label="Event Details"
					placeholder="Date, location, audience size, and desired outcomes"
					error={eventDetailsError}
					rows={4}
					{...submitBookingRequest.fields.eventDetails.as('text')}
				/>

				<Button isSubmitting={Boolean(submitBookingRequest.pending)}>
					{submitBookingRequest.pending ? 'Submitting...' : primaryCtaLabel}
				</Button>

				{#if formDisclaimer}
					<p class="text-[11px] leading-relaxed text-on-surface/60">{formDisclaimer}</p>
				{/if}
			</form>
		</div>
	</div>
</section>

<style>
	.mdi--calendar-edit {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V8h14v1h2V5a2 2 0 0 0-2-2m2.7 10.35l-1 1l-2.05-2l1-1c.2-.21.54-.22.77 0l1.28 1.28c.19.2.19.52 0 .72M12 18.94l6.07-6.06l2.05 2L14.06 21H12z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
