<script lang="ts">
	import LandingNavigation from '$lib/components/blocks/LandingNavigation.svelte';
	import LeadInlineBookingSequence from '$lib/components/booking/LeadInlineBookingSequence.svelte';
	import ComplianceFooterSection from '$lib/components/page-sections/ComplianceFooterSection.svelte';
	import { submitRescheduleBooking } from './RescheduleInlineBookingSequence.remote';
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

	const hasSlots = $derived((data.slotGroups?.length ?? 0) > 0);

	function formatSlotRange(startsAtIso: string, endsAtIso: string): string {
		const startsAt = new Date(startsAtIso);
		const endsAt = new Date(endsAtIso);
		const dateLabel = startsAt.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
		const startTime = startsAt.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
		const endTime = endsAt.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});

		return `${dateLabel} ${startTime} - ${endTime}`;
	}
</script>

<svelte:head>
	<title>Reschedule booking</title>
</svelte:head>

<LandingNavigation />

<div class="min-h-screen bg-[var(--surface)] py-12">
	<div id="booking" class="mx-auto w-full max-w-6xl px-4 pt-20 lg:pt-24">
		<div class="space-y-8 bg-[var(--surface-card)] p-8 shadow-[var(--shadow-card)] lg:p-10">
			<p class="text-[0.6rem] tracking-[0.5em] text-[var(--text-muted)] uppercase">
				Campaign studio
			</p>
			<h1 class="text-4xl font-semibold text-[var(--text-primary)]">Reschedule booking</h1>

			{#if data.tokenState === 'invalid_token'}
				<div
					class="rounded-none border border-rose-400/70 bg-rose-50 px-4 py-4 text-sm text-rose-700"
				>
					{data.message ?? 'This reschedule link is invalid.'}
				</div>
			{:else if !data.currentBooking}
				<div
					class="rounded-none border border-rose-400/70 bg-rose-50 px-4 py-4 text-sm text-rose-700"
				>
					Booking details could not be loaded.
				</div>
			{:else}
				<div
					class="rounded-none border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
				>
					<p>
						Current time:
						<strong
							>{formatSlotRange(
								data.currentBooking.startsAtIso,
								data.currentBooking.endsAtIso
							)}</strong
						>
					</p>
					<p>
						Booking type: <strong>{data.currentBooking.bookingType}</strong>
					</p>
					<p>
						Attendee: <strong>{data.currentBooking.name ?? data.currentBooking.email}</strong>
					</p>
				</div>

				{#if data.message}
					<div
						class="rounded-none border border-amber-400/70 bg-amber-50 px-4 py-4 text-sm text-amber-700"
					>
						{data.message}
					</div>
				{/if}

				{#if !hasSlots}
					<div
						class="rounded-none border border-amber-400/70 bg-amber-50 px-4 py-4 text-sm text-amber-700"
					>
						No replacement slots are currently available in the next 3 days.
					</div>
				{:else}
					<LeadInlineBookingSequence
						submitAction={submitRescheduleBooking}
						slotGroups={data.slotGroups as SlotDayGroup[]}
						showIntakeStep={false}
					/>
				{/if}
			{/if}
		</div>
	</div>
</div>

<div id="contact">
	<ComplianceFooterSection />
</div>
