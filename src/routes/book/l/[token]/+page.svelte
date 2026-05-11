<script lang="ts">
	import { enhance } from '$app/forms';
	import { preloadData, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import LandingNavigation from '$lib/components/blocks/LandingNavigation.svelte';
	import LeadInlineBookingSequence from '$lib/components/booking/LeadInlineBookingSequence.svelte';
	import Button from '$lib/components/elements/Button.svelte';
	import Input from '$lib/components/elements/Input.svelte';
	import TextArea from '$lib/components/elements/TextArea.svelte';
	import ComplianceFooterSection from '$lib/components/page-sections/ComplianceFooterSection.svelte';
	import { submitLeadTokenBooking } from './LeadTokenBookingSequence.remote';
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

	let localForm = $state<ActionData>(null);
	const form = $derived(formProp ?? localForm);
	const isInModal = $derived((page.state as App.PageState).modal?.kind === 'booking');

	const emptyValues = {
		email: '',
		name: '',
		phone: '',
		company: '',
		scope: ''
	};

	const isNewBooking = $derived(data.tokenState === 'new');
	const isTokenUsable = $derived(data.tokenState === 'usable' || isNewBooking);
	const isUnavailable = $derived(isTokenUsable && data.policyState !== 'active');
	const activeValues = $derived(form?.values ?? data.prefillValues ?? emptyValues);
	const activeAvailabilityState = $derived(form?.availabilityState ?? data.availabilityState);
	const activeSlotGroups = $derived<SlotDayGroup[]>(form?.slotGroups ?? data.slotGroups ?? []);
	const hasAvailableSlots = $derived(
		activeAvailabilityState === 'available' && activeSlotGroups.length > 0
	);

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

	const showIntakeStage = $derived(
		(isNewBooking && !form?.redirectToken) || (!data.intakeSkipped && !hasAvailableSlots)
	);
</script>

<svelte:head>
	<title>Schedule a video call briefing</title>
</svelte:head>

<LandingNavigation />

<div class="min-h-screen bg-(--surface) py-12">
	<div id="booking" class="mx-auto w-full max-w-6xl px-4 pt-20 lg:pt-24">
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
							id="phone"
							name="phone"
							label="Phone (optional)"
							type="tel"
							placeholder="+491234567890"
							value={activeValues.phone}
							error={form?.errors?.phone}
							autocomplete="tel"
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
				{:else if hasAvailableSlots}
					<LeadInlineBookingSequence
						submitAction={submitLeadTokenBooking}
						slotGroups={activeSlotGroups}
						showIntakeStep={false}
						initialValues={{
							email: activeValues.email,
							name: activeValues.name,
							phone: activeValues.phone,
							company: activeValues.company,
							scope: activeValues.scope
						}}
					/>
				{/if}
			{/if}
		</div>
	</div>
</div>

<div id="contact">
	<ComplianceFooterSection />
</div>
