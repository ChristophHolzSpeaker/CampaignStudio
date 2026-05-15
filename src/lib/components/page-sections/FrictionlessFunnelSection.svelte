<script lang="ts">
	import Button from '$lib/components/elements/Button.svelte';
	import Input from '$lib/components/elements/Input.svelte';
	import TextArea from '$lib/components/elements/TextArea.svelte';
	import LeadInlineBookingSequence from '$lib/components/booking/LeadInlineBookingSequence.svelte';
	import { page } from '$app/state';
	import type { FrictionlessFunnelBookingProps } from '$lib/page-builder/sections/types';
	import { submitBookingRequest } from './FrictionlessFunnelSection.remote';
	import type { CTAType } from '../../../../shared/event-types';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';

	let {
		props,
		campaignId = null,
		campaignPageId = null,
		bookingSlotGroups = []
	}: {
		props?: FrictionlessFunnelBookingProps;
		campaignId?: number | null;
		campaignPageId?: number | null;
		bookingSlotGroups?: { dateKey: string; slots: { startsAtIso: string; endsAtIso: string }[] }[];
	} = $props();

	let hasTrackedFormStart = $state(false);

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
	class="bg-surface-container relative px-6 py-20 sm:px-8 lg:px-12 lg:py-28"
	aria-label="Frictionless Funnel Booking section"
>
	<SectionIdentifier props={{ id: 'frictionless_funnel' }}></SectionIdentifier>
	<div class="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-16">
		<div class="space-y-8">
			<h2 class="text-4xl leading-[0.95] font-bold tracking-tight text-on-surface lg:text-6xl">
				{title}
			</h2>
			<p class="max-w-xl text-lg leading-relaxed text-on-surface/75">{description}</p>
		</div>

		<!--
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
			</form>-->

		<LeadInlineBookingSequence
			{campaignId}
			{campaignPageId}
			pageSlug={pageSlug ?? null}
			slotGroups={bookingSlotGroups}
			formActionKey={`frictionless-inline-booking:${campaignPageId ?? 'none'}`}
			bookingSurface="frictionless_funnel"
			ctaKey="frictionless_funnel_inline_booking"
			ctaSection="frictionless_funnel"
		/>
	</div>
</section>
