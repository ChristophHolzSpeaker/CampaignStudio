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
	import MarkdownText from '$lib/components/elements/MarkdownText.svelte';

	type PlannerMessage = {
		role: 'user' | 'assistant';
		content: string;
	};

	type PlannerState = {
		messages: PlannerMessage[];
		resolvedFields: CampaignFormSubmission;
		planMarkdown: string;
		questions: string[];
		missingFields: Array<'name' | 'audience' | 'format' | 'topic' | 'language' | 'geography'>;
		readyToCreate: boolean;
	};

	type PlannerActionData = ActionData & {
		planner?: PlannerState;
		mode?: 'manual' | 'planner';
	};

	let { form }: { form?: PlannerActionData } = $props();

	const defaultValues: CampaignFormSubmission = {
		name: '',
		audience: '',
		format: '',
		topic: '',
		language: '',
		geography: '',
		notes: ''
	};

	const defaultPlanner: PlannerState = {
		messages: [],
		resolvedFields: defaultValues,
		planMarkdown: '',
		questions: [],
		missingFields: ['name', 'audience', 'format', 'topic', 'language', 'geography'],
		readyToCreate: false
	};

	const getValues = () => form?.values ?? defaultValues;
	const getErrors = () => form?.errors ?? {};
	const getStatusMessage = () => form?.message;
	const getPlanner = () => form?.planner ?? defaultPlanner;

	let selectedMode = $state<'manual' | 'planner'>('planner');
	let isSubmitting = $state(false);
	const mode = $derived(form?.mode ?? selectedMode);

	const plannerAction = $derived(
		getPlanner().messages.length ? '?/continuePlanner' : '?/startPlanner'
	);
	const plannerStateSerialized = $derived(JSON.stringify(getPlanner()));

	const getFieldError = (field: keyof CampaignFormSubmission) => getErrors()[field]?.[0];

	function handleSubmit() {
		isSubmitting = true;
	}
</script>

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
					Switch between direct briefing and planner chat. Planner mode runs a conversational Q&A,
					infers campaign fields, and only unlocks creation once the brief is complete.
				</p>
			</div>
		</div>

		<div class="h-[4px w-24 bg-(--divider)"></div>

		<div class="flex gap-2">
			<button
				type="button"
				class="horizontal-sm vertical-xs cursor-pointer px-3 uppercase"
				class:bg-primary={mode === 'planner'}
				class:text-white={mode === 'planner'}
				class:bg-white={mode !== 'planner'}
				class:text-(--text-primary)={mode !== 'planner'}
				onclick={() => (selectedMode = 'planner')}
			>
				Planner mode
			</button>
			<button
				type="button"
				class="horizontal-sm vertical-xs cursor-pointer px-3 uppercase"
				class:bg-primary={mode === 'manual'}
				class:text-white={mode === 'manual'}
				class:bg-white={mode !== 'manual'}
				class:text-(--text-primary)={mode !== 'manual'}
				onclick={() => (selectedMode = 'manual')}
			>
				Manual fields
			</button>
		</div>

		{#if getStatusMessage()}
			<div
				role="status"
				class="horizontal-xs vertical-xs bg-(--status-surface) text-xs font-semibold text-(--accent) uppercase"
			>
				{getStatusMessage()}
			</div>
		{/if}

		{#if mode === 'planner'}
			<div class="relative grid gap-10 lg:grid-cols-[1fr_1fr]">
				<div class="horizontal-lg vertical-lg bg-(--surface-card) shadow-(--shadow-card-strong)">
					<p class="text-[0.6rem] text-(--accent) uppercase">Current plan</p>

					{#if getPlanner().planMarkdown}
						<div class="mt-6 bg-(--surface) p-4 text-sm leading-7 marker:text-primary">
							<MarkdownText content={getPlanner().planMarkdown} />
						</div>
					{/if}

					<div class="mt-6 space-y-3 bg-[#fbecee] p-3 text-sm text-(--text-muted)">
						<p class="text-[0.6rem] text-(--text-muted) uppercase">Missing information</p>
						{#if getPlanner().missingFields.length === 0}
							<p>All required fields are resolved.</p>
						{:else}
							<p>{getPlanner().missingFields.join(', ')}</p>
						{/if}
					</div>

					{#if getPlanner().questions.length > 0}
						<div class="mt-6 space-y-2 text-sm">
							<p class="text-[0.6rem] text-(--text-muted) uppercase">Planner questions</p>
							<ul class="space-y-2">
								{#each getPlanner().questions as question, index (`question-${index}`)}
									<li class="horizontal-sm vertical-xs bg-(--surface) p-3">{question}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<div class="mt-8 space-y-2">
						<form method="POST" action="?/create" onsubmit={handleSubmit}>
							<input type="hidden" name="mode" value="planner" />
							<input type="hidden" name="plannerState" value={plannerStateSerialized} />
							<input type="hidden" name="name" value={getPlanner().resolvedFields.name} />
							<input type="hidden" name="audience" value={getPlanner().resolvedFields.audience} />
							<input type="hidden" name="format" value={getPlanner().resolvedFields.format} />
							<input type="hidden" name="topic" value={getPlanner().resolvedFields.topic} />
							<input type="hidden" name="language" value={getPlanner().resolvedFields.language} />
							<input type="hidden" name="geography" value={getPlanner().resolvedFields.geography} />
							<input type="hidden" name="notes" value={getPlanner().resolvedFields.notes} />
							{#if getPlanner().readyToCreate}
								<Button isSubmitting={isSubmitting || !getPlanner().readyToCreate}>
									Create Campaign
								</Button>
							{/if}
						</form>
						<p class="text-[0.6rem] text-(--text-muted) uppercase">
							{#if getPlanner().readyToCreate}
								Brief complete. Creation uses the same generation pipeline as manual mode.
							{:else}
								Answer the planner questions to unlock campaign creation.
							{/if}
						</p>
					</div>
				</div>
				<div class="horizontal-lg vertical-lg bg-(--surface-card) shadow-(--shadow-card)">
					<p class="text-[0.6rem] text-(--accent) uppercase">Planner chat</p>

					<div class="mt-6 space-y-4">
						{#if getPlanner().messages.length === 0}
							<p class="text-sm text-(--text-muted)">
								Ask for a new campaign in natural language. The planner will infer fields and ask
								concise follow-up questions.
							</p>
						{/if}

						{#each getPlanner().messages as message, index (`${message.role}-${index}`)}
							<div
								class="horizontal-sm vertical-sm border-l-2 p-3 text-sm whitespace-pre-wrap text-stone-600"
								class:bg-(--surface)={message.role === 'assistant'}
								class:bg-[#fbecee]={message.role === 'user'}
								class:border-slate-400={message.role === 'assistant'}
								class:border-primary={message.role === 'user'}
							>
								<p class="mb-2 text-[0.6rem] text-(--text-muted) uppercase">
									{message.role === 'assistant' ? 'Planner' : 'Christoph'}
								</p>
								{#if message.role === 'assistant'}
									<MarkdownText content={message.content} />
								{:else}
									{message.content}
								{/if}
							</div>
						{/each}
					</div>

					<form method="POST" action={plannerAction} class="mt-6 space-y-4" onsubmit={handleSubmit}>
						<input type="hidden" name="mode" value="planner" />
						<input type="hidden" name="plannerState" value={plannerStateSerialized} />
						<TextArea
							id="plannerMessage"
							name="plannerMessage"
							label="Your message"
							helper="Describe your campaign naturally."
						></TextArea>
						<Button {isSubmitting}>
							{#if isSubmitting}
								Sending...
							{:else if getPlanner().messages.length === 0}
								Start planning
							{:else}
								Send reply
							{/if}
						</Button>
					</form>
				</div>
			</div>
		{:else}
			<div class="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
				<div
					class="horizontal-lg vertical-lg relative overflow-hidden rounded-none bg-(--surface-card) shadow-(--shadow-card)"
				>
					<div
						class="pointer-events-none absolute -top-8 right-10 h-24 w-24 rounded-full blur-3xl"
						style="background: radial-gradient(circle, rgba(var(--accent-rgb), 0.3) 0%, transparent 70%);"
					></div>
					<div class="flex items-center justify-between gap-4">
						<p class="text-[0.6rem] text-(--accent) uppercase">Pulse checklist</p>
						<div class="h-[4px w-28 bg-(--divider)"></div>
					</div>
					<ul class="mt-8 space-y-4 text-sm leading-7 text-(--text-muted)">
						<li class="flex items-start gap-3">
							<span class="text-(--accent)">•</span>
							Keep each field concise; the AI engine relies on sharp, intentional prompts.
						</li>
						<li class="flex items-start gap-3">
							<span class="text-(--accent)">•</span>
							Audience and format establish tone. Choose the precise match.
						</li>
						<li class="flex items-start gap-3">
							<span class="text-(--accent)">•</span>
							Topic is your headline: direct, bold, and commercially clear.
						</li>
						<li class="flex items-start gap-3">
							<span class="text-(--accent)">•</span>
							Notes are optional, but useful for references, constraints, and tone.
						</li>
					</ul>
				</div>

				<form
					method="POST"
					action="?/create"
					class="horizontal-lg vertical-lg space-y-6 rounded-none bg-(--surface-card)/90 shadow-(--shadow-card-strong)"
					onsubmit={handleSubmit}
				>
					<input type="hidden" name="mode" value="manual" />
					<p class="text-[0.6rem] text-(--accent) uppercase">Campaign brief</p>

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
								Creating...
							{:else}
								Create Campaign
							{/if}
						</Button>

						<p class="text-[0.6rem] text-(--text-muted) uppercase">
							New campaigns are saved with <span class="font-semibold text-(--text-primary)"
								>draft</span
							> status.
						</p>
					</div>
				</form>
			</div>
		{/if}
	</div>
</section>
