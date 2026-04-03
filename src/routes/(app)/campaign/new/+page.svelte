<script lang="ts">
	import type { ActionData } from './$types';
	import {
		audienceOptions,
		formatOptions,
		type CampaignFormSubmission
	} from '$lib/validation/campaign';
	import Button from '$lib/components/elements/Button.svelte';
	import Input from '$lib/components/elements/Input.svelte';
	import Select from '$lib/components/elements/Select.svelte';
	import TextArea from '$lib/components/elements/TextArea.svelte';

	let { form }: { form?: ActionData } = $props();
	const defaultValues: CampaignFormSubmission = {
		name: '',
		audience: '',
		format: '',
		topic: '',
		notes: ''
	};

	const getValues = () => form?.values ?? defaultValues;
	const getErrors = () => form?.errors ?? {};
	const getStatusMessage = () => form?.message;

	let isSubmitting = $state(false);

	const getFieldError = (field: keyof CampaignFormSubmission) => getErrors()[field]?.[0];

	function handleSubmit() {
		isSubmitting = true;
	}
</script>

<section
	class="relative min-h-screen overflow-hidden bg-[var(--surface)] px-6 py-16 text-[var(--text-primary)]"
>
	<div
		class="pointer-events-none absolute -top-12 right-10 h-56 w-56 rounded-full blur-3xl"
		style="background: radial-gradient(circle, rgba(var(--accent-rgb), 0.3) 0%, transparent 70%);"
	></div>
	<div
		class="pointer-events-none absolute bottom-12 left-6 h-52 w-52 rounded-full blur-3xl"
		style="background: radial-gradient(circle, rgba(var(--accent-strong-rgb), 0.2) 0%, transparent 70%);"
	></div>

	<div class="relative mx-auto max-w-6xl space-y-14">
		<header class="space-y-6">
			<p class="text-xs text-[var(--accent)] uppercase">Campaign Intake Studio</p>
			<div class="flex flex-col gap-2">
				<div class="flex flex-wrap items-end gap-6">
					<h1
						class="text-[clamp(2.75rem,4vw,5rem)] leading-[0.9] font-bold text-[var(--text-primary)] uppercase"
					>
						New Campaign
					</h1>
				</div>
			</div>
			<p class="max-w-3xl text-sm leading-7 text-[var(--text-muted)] uppercase">
				Capture the briefing essentials before the AI generation pipeline takes over. Keep an eye on
				the tone, treat every field as a paragraph, and let the system translate your editorial
				intent.
			</p>
		</header>

		<div class="h-[4px] w-24 bg-[var(--divider)]"></div>

		<div class="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
			<div
				class="relative overflow-hidden rounded-none bg-[var(--surface-card)] px-10 py-10 shadow-[var(--shadow-card)]"
			>
				<div
					class="pointer-events-none absolute -top-8 right-10 h-24 w-24 rounded-full blur-3xl"
					style="background: radial-gradient(circle, rgba(var(--accent-rgb), 0.3) 0%, transparent 70%);"
				></div>
				<div class="flex items-center justify-between gap-4">
					<p class="text-[0.6rem] text-[var(--accent)] uppercase">Pulse checklist</p>
					<div class="h-[4px] w-28 bg-[var(--divider)]"></div>
				</div>
				<ul class="mt-8 space-y-4 text-sm leading-7 text-[var(--text-muted)]">
					<li class="flex items-start gap-3">
						<span class="text-[var(--accent)]">•</span>
						Keep each field concise—the AI engine relies on sharp, intentional prompts.
					</li>
					<li class="flex items-start gap-3">
						<span class="text-[var(--accent)]">•</span>
						Audience and format establish tone. Choose the precise match, not the generic option.
					</li>
					<li class="flex items-start gap-3">
						<span class="text-[var(--accent)]">•</span>
						Topic is your headline. Let it feel like a display treatise—direct, bold, layered.
					</li>
					<li class="flex items-start gap-3">
						<span class="text-[var(--accent)]">•</span>
						Notes are optional, but they anchor references, constraints, and tonal nuances.
					</li>
				</ul>
			</div>

			<form
				method="POST"
				class="space-y-6 rounded-none bg-[var(--surface-card)]/90 px-10 py-10 shadow-[var(--shadow-card-strong)]"
				onsubmit={handleSubmit}
			>
				<p class="text-[0.6rem] text-[var(--accent)] uppercase">Campaign brief</p>

				<p class="text-[0.6rem] text-[var(--text-muted)] uppercase">
					Reasoning: A "Dinner Speech on AI for Bankers" requires fundamentally different copy, pain
					points, and tech riders than an "Endnote on Ethics for IT"; the database dynamically
					assembles pages from those relations.
				</p>

				{#if getStatusMessage()}
					<div
						role="status"
						class="bg-[var(--status-surface)] px-4 py-3 text-xs font-semibold text-[var(--accent)] uppercase"
					>
						{getStatusMessage()}
					</div>
				{/if}

				<Input
					id="name"
					name="name"
					type="text"
					value={getValues().name}
					error={getFieldError('name')}
					autocomplete="off"
					label="Campaign name"
				></Input>

				<div class="grid gap-6 md:grid-cols-2">
					<Select
						id="audience"
						name="audience"
						label="Audience"
						options={audienceOptions}
						placeholder="Select an audience"
						value={getValues().audience}
						error={getFieldError('audience')}
					></Select>
					<Select
						id="format"
						name="format"
						label="Format"
						options={formatOptions}
						placeholder="Select format"
						value={getValues().format}
						error={getFieldError('format')}
					></Select>
				</div>

				<p class="text-[0.6rem] text-[var(--text-muted)] uppercase">
					Formats exclude slides—these speech-first moments keep the narrative tight for every
					audience-format pair.
				</p>

				<Input
					id="topic"
					name="topic"
					type="text"
					value={getValues().topic}
					error={getFieldError('topic')}
					placeholder="AI, Digital Ethics, Robotics, Space Technology, ..."
					autocomplete="off"
					label="Topic"
				></Input>

				<p class="text-[0.6rem] text-[var(--text-muted)] uppercase">
					Trending topics help the AI pick the right stance—AI, Digital Ethics, Robotics, Space
					Technology, or whatever feels timely.
				</p>

				<TextArea
					id="notes"
					name="notes"
					label="Notes (optional)"
					value={getValues().notes}
					error={getFieldError('notes')}
					helper="Frame the tone, references, or constraints you want the AI to honor."
				></TextArea>

				<div class="space-y-2">
					<Button {isSubmitting}>
						{#if isSubmitting}
							<span class="mr-2 inline-flex h-4 w-4 items-center justify-center">
								<span
									class="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"
								></span>
							</span>
							Creating...
						{:else}
							Create Campaign
						{/if}
					</Button>

					<p class="text-[0.6rem] text-[var(--text-muted)] uppercase">
						New campaigns are saved with <span class="font-semibold text-[var(--text-primary)]"
							>draft</span
						> status.
					</p>
				</div>
			</form>
		</div>
	</div>
</section>
