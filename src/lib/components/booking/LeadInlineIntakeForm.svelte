<script lang="ts">
	import Input from '$lib/components/elements/Input.svelte';
	import TextArea from '$lib/components/elements/TextArea.svelte';
	import { submitInlineLeadIntake } from '$lib/components/booking/LeadInlineIntakeForm.remote';

	type SubmitAction = {
		pending?: unknown;
		result?: {
			success?: boolean;
			message?: string;
		};
		[key: string]: unknown;
	};

	type Props = {
		submitAction?: SubmitAction;
		campaignId?: number | null;
		campaignPageId?: number | null;
		pageSlug?: string | null;
		formActionKey?: string;
		bookingSurface?: string;
		ctaKey?: string;
		ctaSection?: string;
		ctaVariant?: string | null;
	};

	let {
		submitAction,
		campaignId = null,
		campaignPageId = null,
		pageSlug = null,
		formActionKey = 'inline-lead-intake',
		bookingSurface = 'inline_intake',
		ctaKey = 'inline_lead_intake',
		ctaSection = 'booking',
		ctaVariant = null
	}: Props = $props();

	const resolvedSubmitAction = $derived(
		submitAction ?? submitInlineLeadIntake.for(`${formActionKey}:${campaignPageId ?? 'none'}`)
	);

	let intakeEmail = $state('');
	let intakeName = $state('');
	let intakePhone = $state('');
	let intakeCompany = $state('');
	let intakeScope = $state('');
	let hideFailureMessage = $state(false);

	const submitResult = $derived(resolvedSubmitAction.result);
	const isSubmitSuccess = $derived(Boolean(submitResult?.success));
	const showFailureMessage = $derived(
		Boolean(submitResult?.message && !submitResult.success && !hideFailureMessage)
	);
	const resultTone = $derived(
		submitResult?.success
			? 'border-emerald-400/70 bg-emerald-50 text-emerald-700'
			: 'border-rose-400/70 bg-rose-50 text-rose-700'
	);

	function resetFormUi(): void {
		hideFailureMessage = true;
	}

	const meetingScopePlaceholder = `Wir planen einen Event:
Datum und Uhrzeit:
Veranstaltungsort:`;
</script>

<section class="w-full space-y-6">
	{#if isSubmitSuccess && submitResult?.message}
		<div class={`rounded-none border px-4 py-3 text-xs font-semibold uppercase ${resultTone}`}>
			{submitResult.message}
		</div>
	{:else}
		<form
			{...resolvedSubmitAction}
			class="space-y-8"
			oninput={() => {
				hideFailureMessage = false;
			}}
			onsubmit={() => {
				hideFailureMessage = false;
			}}
		>
			{#if showFailureMessage}
				<div class={`rounded-none border px-4 py-3 text-xs font-semibold uppercase ${resultTone}`}>
					<p>{submitResult?.message}</p>
					<button
						type="button"
						class="mt-2 inline-flex text-xs tracking-[0.15em] text-rose-700 uppercase underline hover:text-rose-900"
						onclick={resetFormUi}
					>
						Anfrage erneut versuchen
					</button>
				</div>
			{/if}

			<input type="hidden" name="campaignId" value={campaignId ?? ''} />
			<input type="hidden" name="campaignPageId" value={campaignPageId ?? ''} />
			<input type="hidden" name="pageSlug" value={pageSlug ?? ''} />
			<input type="hidden" name="bookingSurface" value={bookingSurface} />
			<input type="hidden" name="ctaKey" value={ctaKey} />
			<input type="hidden" name="ctaSection" value={ctaSection} />
			<input type="hidden" name="ctaVariant" value={ctaVariant ?? ''} />

			<div class="grid gap-5 md:grid-cols-2">
				<Input
					id="lead-inline-intake-email"
					name="email"
					label="Email*"
					type="email"
					placeholder="sie@beispiel.de"
					required
					autocomplete="email"
					bind:value={intakeEmail}
				/>

				<Input
					id="lead-inline-intake-name"
					name="name"
					label="Name*"
					type="text"
					placeholder="Ihr Name"
					required
					autocomplete="name"
					bind:value={intakeName}
				/>
			</div>

			<Input
				id="lead-inline-intake-phone"
				name="phone"
				label="Telefon (optional)"
				type="tel"
				placeholder="+491234567890"
				autocomplete="tel"
				bind:value={intakePhone}
			/>

			<Input
				id="lead-inline-intake-company"
				name="company"
				label="Unternehmen*"
				type="text"
				placeholder="Ihr Unternehmen"
				required
				autocomplete="organization"
				bind:value={intakeCompany}
			/>

			<TextArea
				id="lead-inline-intake-scope"
				name="scope"
				label="Anfrage-Details*"
				placeholder={meetingScopePlaceholder}
				rows={4}
				required
				bind:value={intakeScope}
			/>

			<div class="flex flex-wrap items-center justify-end gap-3 border-t border-slate-300/60 pt-4">
				<button
					type="submit"
					class="btn btn-primary inline-flex items-center gap-2"
					disabled={Boolean(resolvedSubmitAction.pending)}
				>
					{#if resolvedSubmitAction.pending}
						Bitte warten...
					{:else}
						Anfrage senden
					{/if}
				</button>
			</div>
		</form>
	{/if}
</section>
