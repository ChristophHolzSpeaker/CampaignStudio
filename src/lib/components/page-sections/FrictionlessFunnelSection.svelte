<script lang="ts">
	import Button from '$lib/components/elements/Button.svelte';
	import Input from '$lib/components/elements/Input.svelte';
	import TextArea from '$lib/components/elements/TextArea.svelte';
	import type { FrictionlessFunnelBookingProps } from '$lib/page-builder/sections/types';
	import { submitBookingRequest } from './FrictionlessFunnelSection.remote';

	let { props }: { props?: FrictionlessFunnelBookingProps } = $props();

	const title = $derived(props?.title ?? 'Tell us about your event goals');
	const description = $derived(
		props?.description ??
			'Share your audience, timeline, and desired outcomes. We will follow up with fit and next steps.'
	);
	const primaryCtaLabel = $derived(props?.primaryCtaLabel ?? 'Start Booking Request');
	const trustNote = $derived(props?.trustNote);
	const formDisclaimer = $derived(props?.formDisclaimer);
	const calendlyUrl = $derived(props?.calendlyUrl);

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

			{#if trustNote}
				<p class="max-w-xl text-xs tracking-[0.12em] text-on-surface/65 uppercase">{trustNote}</p>
			{/if}

			{#if calendlyUrl}
				<a
					class="outline-link inline-flex items-center justify-center px-6 py-2"
					href={calendlyUrl}
					target="_blank"
					rel="noreferrer"
				>
					Prefer direct scheduling
				</a>
			{/if}
		</div>

		<div class="border-outline/20 bg-surface p-8 lg:p-10">
			<form
				{...submitBookingRequest}
				class="space-y-6"
				oninput={() => submitBookingRequest.validate()}
			>
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
