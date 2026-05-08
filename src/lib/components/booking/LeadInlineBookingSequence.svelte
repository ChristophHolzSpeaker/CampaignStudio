<script lang="ts">
	import Input from '$lib/components/elements/Input.svelte';
	import TextArea from '$lib/components/elements/TextArea.svelte';
	import { submitInlineLeadBooking } from '$lib/components/booking/LeadInlineBookingSequence.remote';

	type SlotPresentation = {
		startsAtIso: string;
		endsAtIso: string;
	};

	type SlotDayGroup = {
		dateKey: string;
		slots: SlotPresentation[];
	};

	type Props = {
		campaignId?: number | null;
		campaignPageId?: number | null;
		pageSlug?: string | null;
		slotGroups?: SlotDayGroup[] | null;
	};

	let {
		campaignId = null,
		campaignPageId = null,
		pageSlug = null,
		slotGroups = []
	}: Props = $props();

	let selectedStartsAt = $state<string>('');
	let selectedEndsAt = $state<string>('');
	let dayPreference = $state<string | null>(null);

	let intakeEmail = $state('');
	let intakeName = $state('');
	let intakeCompany = $state('');
	let intakeScope = $state('');

	const normalizedSlotGroups = $derived(slotGroups ?? []);
	const hasSlots = $derived(normalizedSlotGroups.length > 0);
	const resolvedDayKey = $derived(
		(() => {
			if (!hasSlots) {
				return null;
			}

			if (dayPreference && normalizedSlotGroups.some((day) => day.dateKey === dayPreference)) {
				return dayPreference;
			}

			if (selectedStartsAt) {
				const dayWithSelectedSlot = normalizedSlotGroups.find((day) =>
					day.slots.some((slot) => slot.startsAtIso === selectedStartsAt)
				);

				if (dayWithSelectedSlot) {
					return dayWithSelectedSlot.dateKey;
				}
			}

			return normalizedSlotGroups[0]?.dateKey ?? null;
		})()
	);
	const selectedDaySlots = $derived(
		normalizedSlotGroups.find((day) => day.dateKey === resolvedDayKey)?.slots ?? []
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
	const hasSelectedSlot = $derived(Boolean(selectedStartsAt && selectedEndsAt));
	const showSlotStage = $derived(hasSlots && !hasSelectedSlot);
	const isSubmitDisabled = $derived(
		!selectedStartsAt || !selectedEndsAt || Boolean(submitInlineLeadBooking.pending)
	);
	const submitResult = $derived(submitInlineLeadBooking.result);
	const resultTone = $derived(
		submitResult?.success
			? 'border-emerald-400/70 bg-emerald-50 text-emerald-700'
			: 'border-rose-400/70 bg-rose-50 text-rose-700'
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

	function selectSlot(slot: SlotPresentation): void {
		selectedStartsAt = slot.startsAtIso;
		selectedEndsAt = slot.endsAtIso;
	}

	function selectDay(dateKey: string): void {
		dayPreference = dateKey;
	}

	function resetToSlotStage(): void {
		selectedStartsAt = '';
		selectedEndsAt = '';
	}
</script>

<section class="space-y-6 bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)] lg:p-8">
	<p class="max-w-2xl text-sm leading-relaxed text-slate-600">
		Please select an available slot first, then share your details to confirm your briefing request.
	</p>

	{#if submitResult?.message}
		<div class={`rounded-none border px-4 py-3 text-xs font-semibold  uppercase ${resultTone}`}>
			{submitResult.message}
		</div>
	{:else}
		<form {...submitInlineLeadBooking} class="space-y-8">
			<input type="hidden" name="campaignId" value={campaignId ?? ''} />
			<input type="hidden" name="campaignPageId" value={campaignPageId ?? ''} />
			<input type="hidden" name="pageSlug" value={pageSlug ?? ''} />
			<input type="hidden" name="selected_starts_at" value={selectedStartsAt} />
			<input type="hidden" name="selected_ends_at" value={selectedEndsAt} />

			{#if hasSlots}
				{#if showSlotStage}
					<section class="space-y-5">
						<div class="space-y-1">
							<p class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">Step 1</p>
							<h2 class="text-xl text-[var(--text-primary)]">Pick an available slot</h2>
						</div>

						<div role="tablist" aria-label="Available briefing days" class="flex flex-wrap gap-2">
							{#each normalizedSlotGroups as day (day.dateKey)}
								<button
									type="button"
									role="tab"
									id={`inline-booking-day-tab-${day.dateKey}`}
									aria-controls={`inline-booking-day-panel-${day.dateKey}`}
									aria-selected={resolvedDayKey === day.dateKey}
									class={[
										'border px-3 py-2  text-xl font-bold uppercase transition',
										resolvedDayKey === day.dateKey
											? 'border-(--accent-strong) bg-(--accent-strong) text-white'
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

						{#if resolvedDayKey}
							<div
								role="tabpanel"
								id={`inline-booking-day-panel-${resolvedDayKey}`}
								aria-labelledby={`inline-booking-day-tab-${resolvedDayKey}`}
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
													aria-checked={selectedStartsAt === slot.startsAtIso}
													class={[
														'border px-3 py-3 text-center font-sans text-base  transition',
														selectedStartsAt === slot.startsAtIso
															? 'border-(--accent-strong) bg-rose-50 text-(--text-primary)'
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
					</section>
				{:else}
					<section class="space-y-5">
						<div class="space-y-1">
							<p class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">Step 2</p>
							<h2 class="text-xl text-[var(--text-primary)]">Share your briefing details</h2>
						</div>

						<div class="grid gap-5 md:grid-cols-2">
							<Input
								id="inline-booking-email"
								name="email"
								label="Email"
								type="email"
								placeholder="you@example.com"
								required
								autocomplete="email"
								bind:value={intakeEmail}
							/>

							<Input
								id="inline-booking-name"
								name="name"
								label="Name"
								type="text"
								placeholder="Your name"
								required
								autocomplete="name"
								bind:value={intakeName}
							/>
						</div>

						<Input
							id="inline-booking-company"
							name="company"
							label="Company"
							type="text"
							placeholder="Your organization"
							required
							autocomplete="organization"
							bind:value={intakeCompany}
						/>

						<TextArea
							id="inline-booking-scope"
							name="scope"
							label="Meeting scope"
							placeholder="Describe goals, audience, or speaking context"
							rows={4}
							required
							bind:value={intakeScope}
						/>

						<div
							class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300/60 pt-4"
						>
							<p class="text-xs text-slate-600">
								Selected slot:
								<strong class="text-slate-900"
									>{formatSlotRange(selectedStartsAt, selectedEndsAt)}</strong
								>
							</p>
							<div class="flex items-center gap-3">
								<button
									type="button"
									class="text-xs tracking-[0.15em] text-slate-600 uppercase underline hover:text-slate-900"
									onclick={() => {
										resetToSlotStage();
									}}
								>
									Change slot
								</button>
								<button
									type="submit"
									class="btn-primary inline-flex items-center gap-2"
									disabled={isSubmitDisabled}
								>
									{#if submitInlineLeadBooking.pending}
										Please wait...
									{:else}
										Confirm briefing slot
									{/if}
								</button>
							</div>
						</div>
					</section>
				{/if}
			{:else}
				<div
					class="space-y-3 border border-amber-300/80 bg-amber-50 px-4 py-4 text-sm text-amber-800"
				>
					<p>No slots are currently available from this page context.</p>
					<a
						href="mailto:hello@christoph.com"
						class="inline-flex items-center text-xs tracking-[0.12em] text-amber-900 uppercase underline"
					>
						Contact us to request a custom time
					</a>
				</div>
			{/if}
		</form>
	{/if}
</section>
