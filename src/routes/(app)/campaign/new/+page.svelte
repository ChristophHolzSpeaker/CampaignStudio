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
	import AdminSidebar from '$lib/components/AdminSidebar.svelte';

	let { form }: { form?: ActionData } = $props();
	const defaultValues: CampaignFormSubmission = {
		name: '',
		audience: '',
		format: '',
		topic: '',
		language: '',
		geography: '',
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

<div class="hidden self-start lg:block">
	<AdminSidebar />
</div>

<section
	class="horizontal-md vertical-xxl relative min-h-screen overflow-hidden bg-(--surface) text-(--text-primary)"
>
	<div class="relative mx-auto max-w-6xl space-y-14">
		<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
			<div class="space-y-2">
				<div class="flex items-center gap-1 text-[0.7rem] tracking-[0.3em] text-[#777] uppercase">
					<span>Prompt Library</span>
					<span class="text-[1rem] text-(--accent)">›</span>
					<span>Editor</span>
				</div>
				<h1 class="mt-1 text-[3.5rem] tracking-[-0.03em]">
					New Campaign<span class="text-(--accent)">.</span>
				</h1>
				<p class="max-w-lg text-[0.95rem] text-[#5d3f3f]">
					Capture the briefing essentials before the AI generation pipeline takes over. Keep an eye
					on the tone, treat every field as a paragraph, and let the system translate your editorial
					intent.
				</p>
			</div>
		</div>

		<div class="h-[4px w-24 bg-(--divider)"></div>

		<div class="lg:grid-cols-[1.05fr_0.95fr relative grid gap-10">
			<div
				class="horizontal-lg vertical-lg relative overflow-hidden rounded-none bg-(--surface-card) shadow-(--shadow-card)"
			>
				<div
					class="pointer-events-none absolute -top-8 right-10 h-24 w-24 rounded-full blur-3xl"
					style="background: radial-gradient(circle, rgba(var(--accent-rgb), 0.3) 0%, transparent 70%);"
				></div>
				<div class="flex items-center justify-between gap-4">
					<p class="text-[0.6rem text-(--accent) uppercase">Pulse checklist</p>
					<div class="h-[4px w-28 bg-(--divider)"></div>
				</div>
				<ul class="mt-8 space-y-4 text-sm leading-7 text-(--text-muted)">
					<li class="flex items-start gap-3">
						<span class="text-(--accent)">•</span>
						Keep each field concise—the AI engine relies on sharp, intentional prompts.
					</li>
					<li class="flex items-start gap-3">
						<span class="text-(--accent)">•</span>
						Audience and format establish tone. Choose the precise match, not the generic option.
					</li>
					<li class="flex items-start gap-3">
						<span class="text-(--accent)">•</span>
						Topic is your headline. Let it feel like a display treatise—direct, bold, layered.
					</li>
					<li class="flex items-start gap-3">
						<span class="text-(--accent)">•</span>
						Notes are optional, but they anchor references, constraints, and tonal nuances.
					</li>
				</ul>
			</div>

			<form
				method="POST"
				class="horizontal-lg vertical-lg space-y-6 rounded-none bg-(--surface-card)/90 shadow-(--shadow-card-strong)"
				onsubmit={handleSubmit}
			>
				<p class="text-[0.6rem text-(--accent) uppercase">Campaign brief</p>

				<p class="text-[0.6rem text-(--text-muted) uppercase">
					Reasoning: A "Dinner Speech on AI for Bankers" requires fundamentally different copy, pain
					points, and tech riders than an "Endnote on Ethics for IT"; the database dynamically
					assembles pages from those relations.
				</p>

				{#if getStatusMessage()}
					<div
						role="status"
						class="horizontal-xs vertical-xs bg-(--status-surface) text-xs font-semibold text-(--accent) uppercase"
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

				<p class="text-[0.6rem text-(--text-muted) uppercase">
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

				<p class="text-[0.6rem text-(--text-muted) uppercase">
					Trending topics help the AI pick the right stance—AI, Digital Ethics, Robotics, Space
					Technology, or whatever feels timely.
				</p>

				<div class="grid gap-6 md:grid-cols-2">
					<Input
						id="language"
						name="language"
						type="text"
						value={getValues().language}
						error={getFieldError('language')}
						placeholder="English, German, French"
						autocomplete="off"
						label="Language"
					></Input>
					<Input
						id="geography"
						name="geography"
						type="text"
						value={getValues().geography}
						error={getFieldError('geography')}
						placeholder="Germany, DACH, Global"
						autocomplete="off"
						label="Geography"
					></Input>
				</div>

				<p class="text-[0.6rem text-(--text-muted) uppercase">
					Language and geography keep every output grounded in the right locale, register, and
					cultural cues.
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

					<p class="text-[0.6rem text-(--text-muted) uppercase">
						New campaigns are saved with <span class="font-semibold text-(--text-primary)"
							>draft</span
						> status.
					</p>
				</div>
			</form>
		</div>
	</div>
</section>
