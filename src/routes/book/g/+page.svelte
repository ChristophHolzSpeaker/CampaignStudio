<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/elements/Button.svelte';
	import Input from '$lib/components/elements/Input.svelte';
	import TextArea from '$lib/components/elements/TextArea.svelte';
	import type { ActionData, PageData } from './$types';

	type SlotPresentation = {
		startsAtIso: string;
		endsAtIso: string;
	};

	type SlotDayGroup = {
		dateKey: string;
		slots: SlotPresentation[];
	};

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	const emptyValues = {
		email: '',
		name: '',
		company: '',
		scope: ''
	};

	const isUnavailable = $derived(data.policyState !== 'active');
	const activeValues = $derived(form?.values ?? emptyValues);
	const activeClassification = $derived(form?.classification);
	const activeAvailabilityState = $derived(form?.availabilityState);
	const activeSlotGroups = $derived<SlotDayGroup[]>(form?.slotGroups ?? []);
	const hasAvailableSlots = $derived(
		activeAvailabilityState === 'available' && activeSlotGroups.length > 0
	);

	let showIntakeEditor = $state(false);
	let dayPreference = $state<string | null>(null);
	let slotPreferenceStart = $state<string | null>(null);

	const confirmationStartsAtIso = $derived(form?.confirmationValues?.selectedStartsAtIso ?? null);

	const showIntakeStage = $derived(!hasAvailableSlots || showIntakeEditor);
	const resolvedDayKey = $derived(
		(() => {
			if (!hasAvailableSlots) {
				return null;
			}

			if (dayPreference && activeSlotGroups.some((day) => day.dateKey === dayPreference)) {
				return dayPreference;
			}

			if (confirmationStartsAtIso) {
				const dayWithConfirmation = activeSlotGroups.find((day) =>
					day.slots.some((slot) => slot.startsAtIso === confirmationStartsAtIso)
				);

				if (dayWithConfirmation) {
					return dayWithConfirmation.dateKey;
				}
			}

			return activeSlotGroups[0]?.dateKey ?? null;
		})()
	);

	const selectedDaySlots = $derived(
		activeSlotGroups.find((day) => day.dateKey === resolvedDayKey)?.slots ?? []
	);

	const resolvedSlot = $derived(
		(() => {
			if (selectedDaySlots.length === 0) {
				return null;
			}

			if (slotPreferenceStart) {
				const preferredSlot = selectedDaySlots.find(
					(slot) => slot.startsAtIso === slotPreferenceStart
				);
				if (preferredSlot) {
					return preferredSlot;
				}
			}

			if (confirmationStartsAtIso) {
				const confirmationSlot = selectedDaySlots.find(
					(slot) => slot.startsAtIso === confirmationStartsAtIso
				);
				if (confirmationSlot) {
					return confirmationSlot;
				}
			}

			return selectedDaySlots[0] ?? null;
		})()
	);

	const slotGroupsForSelectedDay = $derived(
		(() => {
			const morning: SlotPresentation[] = [];
			const afternoon: SlotPresentation[] = [];
			const evening: SlotPresentation[] = [];

			for (const slot of selectedDaySlots) {
				const hour = new Date(slot.startsAtIso).getHours();

				if (hour < 12) {
					morning.push(slot);
					continue;
				}

				if (hour < 17) {
					afternoon.push(slot);
					continue;
				}

				evening.push(slot);
			}

			return [
				{ label: 'Morning', slots: morning },
				{ label: 'Afternoon', slots: afternoon },
				{ label: 'Evening', slots: evening }
			].filter((group) => group.slots.length > 0);
		})()
	);

	function formatDayLabel(dateKey: string): string {
		const date = new Date(`${dateKey}T00:00:00.000Z`);
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatSlotRange(startsAtIso: string, endsAtIso: string): string {
		const startsAt = new Date(startsAtIso);
		const endsAt = new Date(endsAtIso);
		const startTime = startsAt.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
		const endTime = endsAt.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});

		return `${startTime} - ${endTime}`;
	}

	const confirmationTone = $derived(
		form?.confirmationState === 'confirmed'
			? 'border-emerald-400/70 bg-emerald-50 text-emerald-700'
			: form?.confirmationState === 'calendar_sync_failed'
				? 'border-amber-400/70 bg-amber-50 text-amber-700'
				: 'border-rose-400/70 bg-rose-50 text-rose-700'
	);

	function selectDay(dateKey: string): void {
		dayPreference = dateKey;
		slotPreferenceStart = null;
	}

	function selectSlot(slot: SlotPresentation): void {
		slotPreferenceStart = slot.startsAtIso;
	}
</script>

<svelte:head>
	<title>Book a general briefing</title>
</svelte:head>

<div class="min-h-screen bg-[var(--surface)] py-12">
	<div class="mx-auto w-full max-w-6xl px-4">
		<div class="space-y-8 bg-[var(--surface-card)] p-8 shadow-[var(--shadow-card)] lg:p-10">
			<p class="text-[0.6rem] tracking-[0.5em] text-[var(--text-muted)] uppercase">
				Campaign studio
			</p>
			<h1 class="text-4xl font-semibold text-[var(--text-primary)]">General booking request</h1>

			{#if isUnavailable}
				<div
					class="rounded-none border border-amber-400/70 bg-amber-50 px-4 py-4 text-sm text-amber-800"
				>
					{data.unavailableMessage ?? 'Booking is currently unavailable.'}
				</div>
			{:else}
				<p class="max-w-2xl text-sm leading-relaxed text-slate-600">
					Share your details first, then choose the best time in the next 3 days.
				</p>

				{#if form?.message}
					<div
						class={`rounded-none border px-4 py-3 text-xs font-semibold tracking-[0.3em] uppercase ${form.confirmationState ? confirmationTone : form.availabilityState === 'available' ? 'border-emerald-400/70 bg-emerald-50 text-emerald-700' : 'border-amber-400/70 bg-amber-50 text-amber-700'}`}
					>
						{form.message}
					</div>
				{/if}

				{#if showIntakeStage}
					<form
						method="POST"
						action="?/check"
						class="space-y-6"
						use:enhance
						onsubmit={() => {
							showIntakeEditor = false;
						}}
					>
						<div class="grid gap-6 md:grid-cols-2">
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
						</div>

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
				{:else}
					<div class="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)]">
						<section
							class="space-y-5 bg-[var(--color-surface-container-low)] p-5 text-sm text-slate-700"
						>
							<div class="flex items-start justify-between gap-3">
								<h2 class="text-lg text-[var(--text-primary)]">Booking details</h2>
								<button
									type="button"
									class="text-xs tracking-[0.15em] text-slate-600 uppercase underline hover:text-slate-900"
									onclick={() => {
										showIntakeEditor = true;
									}}
								>
									Edit details
								</button>
							</div>

							<dl class="space-y-2">
								{#if activeValues.name}
									<div>
										<dt class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">Name</dt>
										<dd class="text-base text-slate-900">{activeValues.name}</dd>
									</div>
								{/if}
								<div>
									<dt class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">Email</dt>
									<dd class="text-base text-slate-900">{activeValues.email}</dd>
								</div>
								{#if activeValues.company}
									<div>
										<dt class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">
											Organization
										</dt>
										<dd class="text-base text-slate-900">{activeValues.company}</dd>
									</div>
								{/if}
								<div>
									<dt class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">
										Meeting purpose
									</dt>
									<dd class="text-base leading-relaxed text-slate-900">{activeValues.scope}</dd>
								</div>
							</dl>

							{#if activeClassification}
								<div
									class="space-y-1 border-t border-slate-300/60 pt-3 text-xs text-slate-600 uppercase"
								>
									<p>
										Requester type:
										<strong class="text-slate-900"
											>{activeClassification.interactionKind === 'repeat'
												? 'Repeat'
												: 'First-time'}</strong
										>
									</p>
									<p>
										Upcoming booking:
										<strong class="text-slate-900"
											>{activeClassification.hasUpcomingBooking ? 'Yes' : 'No'}</strong
										>
									</p>
								</div>
							{/if}
						</section>

						<section class="space-y-5">
							<div class="space-y-2">
								<p class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">Step 2</p>
								<h2 class="text-2xl text-[var(--text-primary)]">Choose a time</h2>
							</div>

							<div role="tablist" aria-label="Available booking days" class="flex flex-wrap gap-2">
								{#each activeSlotGroups as day (day.dateKey)}
									<button
										type="button"
										role="tab"
										id={`booking-day-tab-${day.dateKey}`}
										aria-controls={`booking-day-panel-${day.dateKey}`}
										aria-selected={resolvedDayKey === day.dateKey}
										class={[
											'border px-3 py-2 text-xs tracking-[0.1em] uppercase transition',
											resolvedDayKey === day.dateKey
												? 'border-[var(--accent)] bg-[var(--accent)] text-white'
												: 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
										]}
										onclick={() => {
											selectDay(day.dateKey);
										}}
									>
										{formatDayLabel(day.dateKey)}
									</button>
								{/each}
							</div>

							<form method="POST" action="?/confirm" class="space-y-5" use:enhance>
								<input type="hidden" name="email" value={activeValues.email} />
								<input type="hidden" name="name" value={activeValues.name} />
								<input type="hidden" name="company" value={activeValues.company} />
								<input type="hidden" name="scope" value={activeValues.scope} />
								<input
									type="hidden"
									name="selected_starts_at"
									value={resolvedSlot?.startsAtIso ?? ''}
								/>
								<input
									type="hidden"
									name="selected_ends_at"
									value={resolvedSlot?.endsAtIso ?? ''}
								/>

								{#if resolvedDayKey}
									<div
										role="tabpanel"
										id={`booking-day-panel-${resolvedDayKey}`}
										aria-labelledby={`booking-day-tab-${resolvedDayKey}`}
										class="space-y-4"
									>
										{#each slotGroupsForSelectedDay as slotGroup (slotGroup.label)}
											<div class="space-y-2">
												<h3 class="text-xs tracking-[0.18em] text-slate-500 uppercase">
													{slotGroup.label}
												</h3>
												<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup">
													{#each slotGroup.slots as slot (slot.startsAtIso)}
														<button
															type="button"
															role="radio"
															aria-checked={resolvedSlot?.startsAtIso === slot.startsAtIso}
															class={[
																'border px-3 py-3 text-left text-sm transition',
																resolvedSlot?.startsAtIso === slot.startsAtIso
																	? 'border-[var(--accent)] bg-rose-50 text-[var(--text-primary)]'
																	: 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
															]}
															onclick={() => {
																selectSlot(slot);
															}}
														>
															{formatSlotRange(slot.startsAtIso, slot.endsAtIso)}
														</button>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								{/if}

								<div
									class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300/60 pt-4"
								>
									<p class="text-xs text-slate-600">
										{#if resolvedSlot}
											Selected:
											<strong class="text-slate-900"
												>{formatSlotRange(resolvedSlot.startsAtIso, resolvedSlot.endsAtIso)}</strong
											>
										{:else}
											Select a slot to continue.
										{/if}
									</p>
									<button
										type="submit"
										class="cursor-pointer bg-[var(--accent)] px-5 py-2 text-sm tracking-[0.12em] text-white uppercase transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
										disabled={!resolvedSlot}
									>
										Confirm selected slot
									</button>
								</div>
							</form>
						</section>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
