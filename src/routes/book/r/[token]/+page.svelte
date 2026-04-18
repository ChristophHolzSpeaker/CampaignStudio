<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	const displayedSlotGroups = $derived(form?.slotGroups ?? data.slotGroups);
	const availabilityState = $derived(form?.availabilityState ?? data.availabilityState);

	function formatDayLabel(dateKey: string): string {
		const date = new Date(`${dateKey}T00:00:00.000Z`);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		});
	}

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

	const confirmationTone = $derived(
		form?.confirmationState === 'rescheduled'
			? 'border-emerald-400/70 bg-emerald-50 text-emerald-700'
			: form?.confirmationState === 'calendar_sync_failed'
				? 'border-amber-400/70 bg-amber-50 text-amber-700'
				: 'border-rose-400/70 bg-rose-50 text-rose-700'
	);
</script>

<svelte:head>
	<title>Reschedule booking</title>
</svelte:head>

<div class="min-h-screen bg-sky-50 py-12">
	<div class="mx-auto w-full max-w-4xl px-4">
		<div class="space-y-8 bg-white p-8 shadow-lg">
			<p class="text-[0.6rem] tracking-[0.5em] text-slate-500 uppercase">Campaign studio</p>
			<h1 class="text-4xl font-semibold text-slate-900">Reschedule booking</h1>

			{#if data.tokenState === 'invalid_token'}
				<div
					class="rounded-2xl border border-rose-400/70 bg-rose-50 px-4 py-4 text-sm text-rose-700"
				>
					{data.message ?? 'This reschedule link is invalid.'}
				</div>
			{:else if !data.currentBooking}
				<div
					class="rounded-2xl border border-rose-400/70 bg-rose-50 px-4 py-4 text-sm text-rose-700"
				>
					Booking details could not be loaded.
				</div>
			{:else}
				<div
					class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
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
						class="rounded-2xl border border-amber-400/70 bg-amber-50 px-4 py-4 text-sm text-amber-700"
					>
						{data.message}
					</div>
				{/if}

				{#if form?.message}
					<div
						class={`rounded-2xl border px-4 py-3 text-xs font-semibold tracking-[0.3em] uppercase ${confirmationTone}`}
					>
						{form.message}
					</div>
				{/if}

				{#if form?.confirmationErrors?.selectedStartsAtIso}
					<div
						class="rounded-2xl border border-rose-400/70 bg-rose-50 px-4 py-4 text-sm text-rose-700"
					>
						{form.confirmationErrors.selectedStartsAtIso}
					</div>
				{/if}

				{#if form?.confirmationState === 'rescheduled' && form.updatedStartsAtIso && form.updatedEndsAtIso}
					<div
						class="rounded-2xl border border-emerald-400/70 bg-emerald-50 px-4 py-4 text-sm text-emerald-700"
					>
						New time: <strong
							>{formatSlotRange(form.updatedStartsAtIso, form.updatedEndsAtIso)}</strong
						>
					</div>
				{/if}

				{#if availabilityState === 'no_slots' || displayedSlotGroups.length === 0}
					<div
						class="rounded-2xl border border-amber-400/70 bg-amber-50 px-4 py-4 text-sm text-amber-700"
					>
						No replacement slots are currently available in the next 3 days.
					</div>
				{:else}
					<div class="space-y-4">
						<h2 class="text-2xl text-slate-900">Available replacement slots</h2>
						{#each displayedSlotGroups as day (day.dateKey)}
							<section class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
								<h3 class="text-lg text-slate-900">{formatDayLabel(day.dateKey)}</h3>
								<ul class="space-y-2">
									{#each day.slots as slot (slot.startsAtIso)}
										<li class="rounded-xl bg-white px-3 py-3 text-sm text-slate-700">
											<form
												method="POST"
												action="?/confirm"
												class="flex items-center justify-between gap-3"
												use:enhance
											>
												<input type="hidden" name="selected_starts_at" value={slot.startsAtIso} />
												<input type="hidden" name="selected_ends_at" value={slot.endsAtIso} />
												<span>{formatSlotRange(slot.startsAtIso, slot.endsAtIso)}</span>
												<button
													class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold uppercase hover:border-slate-500"
													type="submit">Reschedule to this slot</button
												>
											</form>
										</li>
									{/each}
								</ul>
							</section>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
