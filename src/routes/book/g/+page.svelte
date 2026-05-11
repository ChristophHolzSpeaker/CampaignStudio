<script lang="ts">
	import LandingNavigation from '$lib/components/blocks/LandingNavigation.svelte';
	import LeadInlineBookingSequence from '$lib/components/booking/LeadInlineBookingSequence.svelte';
	import ComplianceFooterSection from '$lib/components/page-sections/ComplianceFooterSection.svelte';
	import { submitGeneralInlineBooking } from './GeneralInlineBookingSequence.remote';
	import type { PageData } from './$types';

	type SlotPresentation = {
		startsAtIso: string;
		endsAtIso: string;
	};

	type SlotDayGroup = {
		dateKey: string;
		slots: SlotPresentation[];
	};

	let { data } = $props<{ data: PageData }>();

	const isUnavailable = $derived(data.policyState !== 'active');
	const slotGroups = $derived<SlotDayGroup[]>(data.slotGroups ?? []);
</script>

<svelte:head>
	<title>Schedule a general video call briefing</title>
</svelte:head>

<LandingNavigation />

<div class="min-h-screen bg-[var(--surface)] py-12">
	<div id="booking" class="mx-auto w-full max-w-6xl px-4 pt-20 lg:pt-24">
		<div class="space-y-8 bg-[var(--surface-card)] p-8 shadow-[var(--shadow-card)] lg:p-10">
			<p class="text-[0.6rem] tracking-[0.5em] text-[var(--text-muted)] uppercase">
				Campaign studio
			</p>
			<h1 class="text-4xl font-semibold text-[var(--text-primary)]">General briefing request</h1>

			{#if isUnavailable}
				<div
					class="rounded-none border border-amber-400/70 bg-amber-50 px-4 py-4 text-sm text-amber-800"
				>
					{data.unavailableMessage ?? 'Briefing is currently unavailable.'}
				</div>
			{:else}
				{#if data.message}
					<div
						class="rounded-none border border-amber-400/70 bg-amber-50 px-4 py-3 text-xs font-semibold tracking-[0.3em] text-amber-700 uppercase"
					>
						{data.message}
					</div>
				{/if}

				<LeadInlineBookingSequence submitAction={submitGeneralInlineBooking} {slotGroups} />
			{/if}
		</div>
	</div>
</div>

<div id="contact">
	<ComplianceFooterSection />
</div>
