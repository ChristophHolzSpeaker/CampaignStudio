<script lang="ts">
	import { enhance } from '$app/forms';
	import { preloadData, replaceState } from '$app/navigation';
	import { page } from '$app/state';
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

	let { data, form: formProp } = $props<{ data: PageData; form: ActionData }>();

	// Local form state for handling responses when rendered in modal context
	// (where the form prop may not update automatically)
	let localForm = $state<ActionData>(null);

	// Merged form state: prefer prop (for normal route context), fallback to local (for modal context)
	const form = $derived(formProp ?? localForm);

	// Detect if we're in a modal context
	const isInModal = $derived((page.state as App.PageState).modal?.kind === 'booking');

	const emptyValues = {
		email: '',
		name: '',
		company: '',
		scope: ''
	};

	const isNewBooking = $derived(data.tokenState === 'new');
	const isTokenUsable = $derived(data.tokenState === 'usable' || isNewBooking);
	const isUnavailable = $derived(isTokenUsable && data.policyState !== 'active');
	const activeValues = $derived(form?.values ?? data.prefillValues ?? emptyValues);
	const activeClassification = $derived(form?.classification ?? data.classification);
	const activeAvailabilityState = $derived(form?.availabilityState ?? data.availabilityState);
	const activeSlotGroups = $derived<SlotDayGroup[]>(form?.slotGroups ?? data.slotGroups ?? []);
	const activeMessage = $derived(form?.message ?? data.message);
	const activeIntakeSummary = $derived(form?.intakeSummary ?? data.intakeSummary);
	const hasAvailableSlots = $derived(
		activeAvailabilityState === 'available' && activeSlotGroups.length > 0
	);

	let dayPreference = $state<string | null>(null);
	let slotPreferenceStart = $state<string | null>(null);

	// Custom enhance function that updates local form state
	// This ensures form responses work correctly in both modal and route contexts
	function handleFormResult({ result }: { result: { type: string; data?: unknown } }) {
		if (result.type === 'success' || result.type === 'failure') {
			localForm = (result.data as ActionData) ?? null;
		}
	}

	function readRedirectToken(input: unknown): string | null {
		if (!input || typeof input !== 'object') {
			return null;
		}

		const token = (input as { redirectToken?: unknown }).redirectToken;
		if (typeof token !== 'string') {
			return null;
		}

		const trimmedToken = token.trim();
		return trimmedToken.length > 0 ? trimmedToken : null;
	}

	async function redirectToBookingToken(token: string): Promise<void> {
		const newUrl = `/book/l/${token}`;

		if (isInModal) {
			const result = await preloadData(newUrl);
			if (result.type === 'loaded' && result.status === 200) {
				replaceState(newUrl, {
					...page.state,
					modal: { kind: 'booking', data: result.data }
				});
			}
			return;
		}

		replaceState(newUrl, page.state);
	}

	const confirmationStartsAtIso = $derived(form?.confirmationValues?.selectedStartsAtIso ?? null);
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

	const showIntakeStage = $derived(
		(isNewBooking && !form?.redirectToken) || (!data.intakeSkipped && !hasAvailableSlots)
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

	function selectDay(dateKey: string): void {
		dayPreference = dateKey;
		slotPreferenceStart = null;
	}

	function selectSlot(slot: SlotPresentation): void {
		slotPreferenceStart = slot.startsAtIso;
	}
</script>

<svelte:head>
	<title>Schedule a video call briefing</title>
</svelte:head>

<div class="min-h-screen bg-(--surface) py-12">
	<div class="mx-auto w-full max-w-6xl px-4">
		<div class="space-y-8 bg-(--surface-card) p-8 shadow-(--shadow-card) lg:p-10">
			<p class="text-[0.6rem] tracking-[0.5em] text-(--text-muted) uppercase">Christoph Holz</p>
			<h1 class="text-4xl font-semibold text-(--text-primary)">Briefing request</h1>

			{#if !isTokenUsable}
				<div
					class="rounded-none border border-rose-400/70 bg-rose-50 px-4 py-4 text-sm text-rose-700"
				>
					{data.tokenMessage ?? 'This briefing link cannot be used.'}
				</div>
			{:else if isUnavailable}
				<div
					class="rounded-none border border-amber-400/70 bg-amber-50 px-4 py-4 text-sm text-amber-800"
				>
					{data.unavailableMessage ?? 'Briefing is currently unavailable.'}
				</div>
			{:else}
				<p class="max-w-2xl text-sm leading-relaxed text-slate-600">
					Please confirm your details, then select a slot to schedule a video call briefing with
					Christoph in the next 3 days.
				</p>

				{#if showIntakeStage}
					<form
						method="POST"
						action="?/check"
						class="space-y-6"
						use:enhance={() => {
							return async ({ result, update }) => {
								handleFormResult({ result });

								if (result.type === 'success' && isNewBooking) {
									const redirectToken = readRedirectToken(result.data);
									if (redirectToken) {
										await redirectToBookingToken(redirectToken);
										return;
									}
								}

								// Only run default update behavior if not in modal
								// (in modal context, we handle state updates manually)
								if (!isInModal) {
									await update();
								}
							};
						}}
					>
						{#if isNewBooking}
							<input type="hidden" name="utm_source" value={data.utmContext?.source ?? ''} />
							<input
								type="hidden"
								name="utm_campaignId"
								value={data.utmContext?.campaignId ?? ''}
							/>
							<input
								type="hidden"
								name="utm_campaignPageId"
								value={data.utmContext?.campaignPageId ?? ''}
							/>
							<input type="hidden" name="utm_pageSlug" value={data.utmContext?.pageSlug ?? ''} />
						{/if}

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
				{:else if hasAvailableSlots}
					<div class="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)]">
						<section class="space-y-5 bg-surface-container-low p-5 text-sm text-slate-700">
							<div class="flex items-start justify-between gap-3">
								<h2 class="text-lg text-(--text-primary)">Briefing details</h2>
								<a
									class="text-xs tracking-[0.15em] text-slate-600 uppercase underline hover:text-slate-900"
									href="?edit=1"
								>
									Edit details
								</a>
							</div>

							<dl class="space-y-2">
								{#if activeIntakeSummary?.name || activeValues.name}
									<div>
										<dt class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">Name</dt>
										<dd class="text-base text-slate-900">
											{activeIntakeSummary?.name ?? activeValues.name}
										</dd>
									</div>
								{/if}
								<div>
									<dt class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">Email</dt>
									<dd class="text-base text-slate-900">
										{activeIntakeSummary?.email ?? activeValues.email}
									</dd>
								</div>
								{#if activeIntakeSummary?.company || activeValues.company}
									<div>
										<dt class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">
											Organization
										</dt>
										<dd class="text-base text-slate-900">
											{activeIntakeSummary?.company ?? activeValues.company}
										</dd>
									</div>
								{/if}
								<div>
									<dt class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">
										Meeting purpose
									</dt>
									<dd class="text-base leading-relaxed text-slate-900">
										{activeIntakeSummary?.requestSummary ||
											activeIntakeSummary?.scope ||
											activeValues.scope}
									</dd>
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
										Upcoming briefing:
										<strong class="text-slate-900"
											>{activeClassification.hasUpcomingBooking ? 'Yes' : 'No'}</strong
										>
									</p>
								</div>
							{/if}
						</section>

						<section class="space-y-5">
							{#if form?.confirmationState !== 'confirmed'}
								<div class="space-y-2">
									<p class="text-[0.65rem] tracking-[0.2em] text-slate-500 uppercase">Step 2</p>
									<h2 class="text-2xl text-(--text-primary)">Select a briefing slot</h2>
								</div>

								<div
									role="tablist"
									aria-label="Available briefing days"
									class="flex flex-wrap gap-2"
								>
									{#each activeSlotGroups as day (day.dateKey)}
										<button
											type="button"
											role="tab"
											id={`booking-day-tab-${day.dateKey}`}
											aria-controls={`booking-day-panel-${day.dateKey}`}
											aria-selected={resolvedDayKey === day.dateKey}
											class={[
												'border px-3 py-2 text-xl font-(--font-sans) uppercase transition',
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

								<form
									method="POST"
									action="?/confirm"
									class="space-y-5"
									use:enhance={() => {
										return async ({ result, update }) => {
											handleFormResult({ result });
											// Only run default update behavior if not in modal
											if (!isInModal) {
												await update();
											}
										};
									}}
								>
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
																	'border px-3 py-3 text-center text-base transition',
																	resolvedSlot?.startsAtIso === slot.startsAtIso
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

									<div
										class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300/60 pt-4"
									>
										<p class="text-xs text-slate-600">
											{#if resolvedSlot}
												Selected slot:
												<strong class="text-slate-900"
													>{formatSlotRange(
														resolvedSlot.startsAtIso,
														resolvedSlot.endsAtIso
													)}</strong
												>
											{:else}
												Please select a slot to continue.
											{/if}
										</p>

										<Button>Confirm briefing slot</Button>
									</div>
								</form>
							{/if}
							{#if activeMessage}
								<div
									class={`rounded-none border px-4 py-3 text-xs font-semibold uppercase ${statusTone}`}
								>
									{activeMessage}
								</div>
							{/if}
						</section>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
