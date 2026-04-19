<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/elements/Button.svelte';
	import Input from '$lib/components/elements/Input.svelte';
	import TextArea from '$lib/components/elements/TextArea.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	const emptyValues = {
		email: '',
		name: '',
		company: '',
		scope: ''
	};

	const isTokenUsable = $derived(data.tokenState === 'usable');
	const isUnavailable = $derived(isTokenUsable && data.policyState !== 'active');
	const activeValues = $derived(form?.values ?? data.prefillValues ?? emptyValues);
	const activeClassification = $derived(form?.classification ?? data.classification);
	const activeAvailabilityState = $derived(form?.availabilityState ?? data.availabilityState);
	const activeSlotGroups = $derived(form?.slotGroups ?? data.slotGroups ?? []);
	const activeMessage = $derived(form?.message ?? data.message);
	const activeIntakeSummary = $derived(form?.intakeSummary ?? data.intakeSummary);
	const hasAvailableSlots = $derived(
		activeAvailabilityState === 'available' && activeSlotGroups.length > 0
	);

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

	const statusTone = $derived(
		form?.confirmationState === 'confirmed'
			? 'border-emerald-400/70 bg-emerald-50 text-emerald-700'
			: form?.confirmationState === 'calendar_sync_failed'
				? 'border-amber-400/70 bg-amber-50 text-amber-700'
				: form?.confirmationState === 'slot_unavailable' ||
					  form?.confirmationState === 'booking_unavailable'
					? 'border-rose-400/70 bg-rose-50 text-rose-700'
					: activeAvailabilityState === 'available'
						? 'border-emerald-400/70 bg-emerald-50 text-emerald-700'
						: 'border-amber-400/70 bg-amber-50 text-amber-700'
	);
</script>

<svelte:head>
	<title>Book your lead call</title>
</svelte:head>

<div class="min-h-screen bg-sky-50 py-12">
	<div class="mx-auto w-full max-w-4xl px-4">
		<div class="space-y-8 bg-white p-8 shadow-lg">
			<p class="text-[0.6rem] tracking-[0.5em] text-slate-500 uppercase">Campaign studio</p>
			<h1 class="text-4xl font-semibold text-slate-900">Lead booking request</h1>

			{#if !isTokenUsable}
				<div
					class="rounded-2xl border border-rose-400/70 bg-rose-50 px-4 py-4 text-sm text-rose-700"
				>
					{data.tokenMessage ?? 'This booking link cannot be used.'}
				</div>
			{:else if isUnavailable}
				<div
					class="rounded-2xl border border-amber-400/70 bg-amber-50 px-4 py-4 text-sm text-amber-800"
				>
					{data.unavailableMessage ?? 'Booking is currently unavailable.'}
				</div>
			{:else}
				<p class="text-sm leading-relaxed text-slate-600">
					Confirm your intake details and choose from available slots in the next 3 days.
				</p>

				{#if activeMessage}
					<div
						class={`rounded-2xl border px-4 py-3 text-xs font-semibold tracking-[0.3em] uppercase ${statusTone}`}
					>
						{activeMessage}
					</div>
				{/if}

				{#if !data.intakeSkipped}
					<form method="POST" action="?/check" class="space-y-6" use:enhance>
						<Input
							id="email"
							name="email"
							label="Email"
							type="email"
							placeholder="you@example.com"
							value={activeValues.email}
							error={form?.errors?.email}
							autocomplete="email"
						/>

						<Input
							id="name"
							name="name"
							label="Name (optional)"
							type="text"
							placeholder="Your name"
							value={activeValues.name}
							error={form?.errors?.name}
							autocomplete="name"
						/>

						<Input
							id="company"
							name="company"
							label="Company (optional)"
							type="text"
							placeholder="Your company"
							value={activeValues.company}
							error={form?.errors?.company}
							autocomplete="organization"
						/>

						<TextArea
							id="scope"
							name="scope"
							label="Meeting purpose"
							placeholder="Describe what you want to cover"
							value={activeValues.scope}
							error={form?.errors?.scope}
							rows={4}
						/>

						<Button>Check available slots</Button>
					</form>
				{/if}

				{#if activeClassification}
					<div
						class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
					>
						<p>
							Requester type:
							<strong
								>{activeClassification.interactionKind === 'repeat'
									? 'Repeat'
									: 'First-time'}</strong
							>
						</p>
						<p>
							Upcoming booking:
							<strong>{activeClassification.hasUpcomingBooking ? 'Yes' : 'No'}</strong>
						</p>
					</div>
				{/if}

				{#if hasAvailableSlots}
					<div class="space-y-4">
						{#if activeIntakeSummary}
							<div
								class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
							>
								<div class="flex items-start justify-between gap-3">
									<h2 class="text-base font-semibold text-slate-900">Intake summary</h2>
									<a
										class="text-xs font-semibold text-slate-600 underline hover:text-slate-900"
										href="?edit=1">Edit details</a
									>
								</div>
								{#if activeIntakeSummary.name}
									<p><strong>Name:</strong> {activeIntakeSummary.name}</p>
								{/if}
								<p><strong>Email:</strong> {activeIntakeSummary.email}</p>
								<p>
									<strong>Meeting purpose:</strong>
									{activeIntakeSummary.requestSummary || activeIntakeSummary.scope}
								</p>
							</div>
						{/if}

						<h2 class="text-2xl text-slate-900">Available slots</h2>
						{#each activeSlotGroups as day (day.dateKey)}
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
												<input type="hidden" name="email" value={activeValues.email} />
												<input type="hidden" name="name" value={activeValues.name} />
												<input type="hidden" name="company" value={activeValues.company} />
												<input type="hidden" name="scope" value={activeValues.scope} />
												<input type="hidden" name="selected_starts_at" value={slot.startsAtIso} />
												<input type="hidden" name="selected_ends_at" value={slot.endsAtIso} />
												<span>{formatSlotRange(slot.startsAtIso, slot.endsAtIso)}</span>
												<button
													class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold uppercase hover:border-slate-500"
													type="submit">Confirm slot</button
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
