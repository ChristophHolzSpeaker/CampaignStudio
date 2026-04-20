<script lang="ts">
	import type { ActionData } from './$types';
	import { applyAction, enhance } from '$app/forms';
	import { onDestroy } from 'svelte';
	import { type CampaignFormSubmission } from '$lib/validation/campaign';
	import Button from '$lib/components/elements/Button.svelte';
	import Input from '$lib/components/elements/Input.svelte';
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

	type PipelineStageKey =
		| 'queued'
		| 'saving_campaign'
		| 'campaign_saved'
		| 'generating_google_ads'
		| 'google_ads_done'
		| 'generating_landing_page'
		| 'landing_page_done'
		| 'done'
		| 'failed';

	type PipelineProgressEvent = {
		runId: string;
		step: PipelineStageKey;
		message: string;
		level: 'info' | 'success' | 'error';
		timestamp: string;
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
	let isPlannerSubmitting = $state(false);
	let isCreateSubmitting = $state(false);
	let pipelineRunId = $state('');
	let isPipelineActive = $state(false);
	let pipelineEvents = $state<PipelineProgressEvent[]>([]);
	let currentStageKey = $state<PipelineStageKey | null>(null);
	let pipelineFailedTerminally = $state(false);
	let pipelineSource: EventSource | null = null;
	const mode = $derived(form?.mode ?? selectedMode);

	const plannerAction = $derived(
		getPlanner().messages.length ? '?/continuePlanner' : '?/startPlanner'
	);
	const plannerStateSerialized = $derived(JSON.stringify(getPlanner()));
	const shouldShowPipelineProgress = $derived(isCreateSubmitting || pipelineEvents.length > 0);
	const latestPipelineMessage = $derived(
		pipelineEvents[pipelineEvents.length - 1]?.message ?? 'Waiting for pipeline updates...'
	);

	const isPipelineStepSeen = (step: PipelineStageKey) =>
		pipelineEvents.some((event) => event.step === step);

	const getChecklistRowStatus = (
		step: 'saving_campaign' | 'generating_google_ads' | 'generating_landing_page'
	): 'pending' | 'active' | 'completed' => {
		if (step === 'saving_campaign') {
			if (
				isPipelineStepSeen('campaign_saved') ||
				isPipelineStepSeen('generating_google_ads') ||
				isPipelineStepSeen('google_ads_done') ||
				isPipelineStepSeen('generating_landing_page') ||
				isPipelineStepSeen('landing_page_done') ||
				isPipelineStepSeen('done')
			) {
				return 'completed';
			}

			if (isPipelineStepSeen('saving_campaign')) {
				return 'active';
			}

			return 'pending';
		}

		if (step === 'generating_google_ads') {
			if (
				isPipelineStepSeen('google_ads_done') ||
				isPipelineStepSeen('generating_landing_page') ||
				isPipelineStepSeen('landing_page_done') ||
				isPipelineStepSeen('done')
			) {
				return 'completed';
			}

			if (isPipelineStepSeen('generating_google_ads')) {
				return 'active';
			}

			return 'pending';
		}

		if (isPipelineStepSeen('landing_page_done') || isPipelineStepSeen('done')) {
			return 'completed';
		}

		if (isPipelineStepSeen('generating_landing_page')) {
			return 'active';
		}

		return 'pending';
	};

	const savingCampaignStatus = $derived(getChecklistRowStatus('saving_campaign'));
	const googleAdsStatus = $derived(getChecklistRowStatus('generating_google_ads'));
	const landingPageStatus = $derived(getChecklistRowStatus('generating_landing_page'));

	const getChecklistIndicator = (status: 'pending' | 'active' | 'completed') => {
		if (status === 'completed') {
			return '✓';
		}

		if (status === 'active') {
			return '•';
		}

		return '○';
	};

	const isPipelineProgressEvent = (value: unknown): value is PipelineProgressEvent => {
		if (typeof value !== 'object' || value === null) {
			return false;
		}

		const candidate = value as Partial<PipelineProgressEvent>;
		const validStep =
			typeof candidate.step === 'string' &&
			[
				'queued',
				'saving_campaign',
				'campaign_saved',
				'generating_google_ads',
				'google_ads_done',
				'generating_landing_page',
				'landing_page_done',
				'done',
				'failed'
			].includes(candidate.step);

		return (
			typeof candidate.runId === 'string' &&
			validStep &&
			typeof candidate.message === 'string' &&
			(candidate.level === 'info' ||
				candidate.level === 'success' ||
				candidate.level === 'error') &&
			typeof candidate.timestamp === 'string'
		);
	};

	const getFieldError = (field: keyof CampaignFormSubmission) => getErrors()[field]?.[0];

	function generatePipelineRunId(): string {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}

		return `campaign_create_${Date.now()}_${Math.random().toString(36).slice(2)}`;
	}

	function stopPipelineStream() {
		pipelineSource?.close();
		pipelineSource = null;
		isPipelineActive = false;
	}

	function beginPipelineStream(runId: string) {
		stopPipelineStream();
		isPipelineActive = true;

		const source = new EventSource(`/campaign/new/progress?runId=${encodeURIComponent(runId)}`);
		pipelineSource = source;

		source.addEventListener('pipeline', (event) => {
			const messageEvent = event as MessageEvent<string>;

			try {
				const parsed: unknown = JSON.parse(messageEvent.data);
				if (!isPipelineProgressEvent(parsed)) {
					return;
				}

				pipelineEvents = [...pipelineEvents, parsed];
				currentStageKey = parsed.step;
				pipelineFailedTerminally = parsed.step === 'failed';

				if (parsed.step === 'done' || parsed.step === 'failed') {
					isCreateSubmitting = false;
					stopPipelineStream();
				}
			} catch {
				return;
			}
		});

		source.onerror = () => {
			if (source.readyState === EventSource.CLOSED) {
				isPipelineActive = false;
			}
		};
	}

	const enhanceCreateSubmission = ({ formData }: { formData: FormData }) => {
		isCreateSubmitting = true;
		pipelineFailedTerminally = false;
		currentStageKey = null;
		pipelineEvents = [];

		const runId = generatePipelineRunId();
		pipelineRunId = runId;
		formData.set('pipelineRunId', runId);
		beginPipelineStream(runId);

		return async ({ result }: { result: Parameters<typeof applyAction>[0] }) => {
			await applyAction(result);

			if (result.type === 'failure' || result.type === 'error') {
				isCreateSubmitting = false;
				stopPipelineStream();
			}
		};
	};

	function handlePlannerSubmit() {
		isPlannerSubmitting = true;
	}

	onDestroy(() => {
		stopPipelineStream();
	});
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
						{#if shouldShowPipelineProgress}
							<div class="space-y-3 bg-(--surface) p-4 text-sm">
								<p class="text-[0.6rem] text-(--accent) uppercase">Create pipeline progress</p>
								<ul class="space-y-2 text-(--text-muted)">
									<li class="flex items-center gap-3">
										<span
											class:text-(--text-muted)={savingCampaignStatus === 'pending'}
											class:text-(--accent)={savingCampaignStatus === 'active'}
											class:text-(--text-primary)={savingCampaignStatus === 'completed'}
											>{getChecklistIndicator(savingCampaignStatus)}</span
										>
										<span>Saving campaign</span>
									</li>
									<li class="flex items-center gap-3">
										<span
											class:text-(--text-muted)={googleAdsStatus === 'pending'}
											class:text-(--accent)={googleAdsStatus === 'active'}
											class:text-(--text-primary)={googleAdsStatus === 'completed'}
											>{getChecklistIndicator(googleAdsStatus)}</span
										>
										<span>Generating Google Ads</span>
									</li>
									<li class="flex items-center gap-3">
										<span
											class:text-(--text-muted)={landingPageStatus === 'pending'}
											class:text-(--accent)={landingPageStatus === 'active'}
											class:text-(--text-primary)={landingPageStatus === 'completed'}
											>{getChecklistIndicator(landingPageStatus)}</span
										>
										<span>Generating landing page</span>
									</li>
								</ul>
								<p
									class="text-xs"
									class:text-(--text-muted)={!pipelineFailedTerminally}
									class:text-[#b42318]={pipelineFailedTerminally}
								>
									{latestPipelineMessage}
								</p>
							</div>
						{/if}

						<form method="POST" action="?/create" use:enhance={enhanceCreateSubmission}>
							<input type="hidden" name="mode" value="planner" />
							<input type="hidden" name="plannerState" value={plannerStateSerialized} />
							<input type="hidden" name="pipelineRunId" value={pipelineRunId} />
							<input type="hidden" name="name" value={getPlanner().resolvedFields.name} />
							<input type="hidden" name="audience" value={getPlanner().resolvedFields.audience} />
							<input type="hidden" name="format" value={getPlanner().resolvedFields.format} />
							<input type="hidden" name="topic" value={getPlanner().resolvedFields.topic} />
							<input type="hidden" name="language" value={getPlanner().resolvedFields.language} />
							<input type="hidden" name="geography" value={getPlanner().resolvedFields.geography} />
							<input type="hidden" name="notes" value={getPlanner().resolvedFields.notes} />
							{#if getPlanner().readyToCreate}
								<Button isSubmitting={isCreateSubmitting || !getPlanner().readyToCreate}>
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

					<form
						method="POST"
						action={plannerAction}
						class="mt-6 space-y-4"
						onsubmit={handlePlannerSubmit}
					>
						<input type="hidden" name="mode" value="planner" />
						<input type="hidden" name="plannerState" value={plannerStateSerialized} />
						<TextArea
							id="plannerMessage"
							name="plannerMessage"
							label="Your message"
							helper="Describe your campaign naturally."
						></TextArea>
						<Button isSubmitting={isPlannerSubmitting}>
							{#if isPlannerSubmitting}
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
							Audience and format establish tone. Keep them specific and commercially clear.
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
					use:enhance={enhanceCreateSubmission}
				>
					<input type="hidden" name="mode" value="manual" />
					<input type="hidden" name="pipelineRunId" value={pipelineRunId} />
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
						<Input
							id="audience"
							name="audience"
							type="text"
							value={getValues().audience}
							error={getFieldError('audience')}
							placeholder="CIOs at industrial enterprises"
							autocomplete="off"
							label="Audience"
						></Input>
						<Input
							id="format"
							name="format"
							type="text"
							value={getValues().format}
							error={getFieldError('format')}
							placeholder="Executive breakfast briefing"
							autocomplete="off"
							label="Format"
						></Input>
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
						{#if shouldShowPipelineProgress}
							<div class="space-y-3 bg-(--surface) p-4 text-sm">
								<p class="text-[0.6rem] text-(--accent) uppercase">Create pipeline progress</p>
								<ul class="space-y-2 text-(--text-muted)">
									<li class="flex items-center gap-3">
										<span
											class:text-(--text-muted)={savingCampaignStatus === 'pending'}
											class:text-(--accent)={savingCampaignStatus === 'active'}
											class:text-(--text-primary)={savingCampaignStatus === 'completed'}
											>{getChecklistIndicator(savingCampaignStatus)}</span
										>
										<span>Saving campaign</span>
									</li>
									<li class="flex items-center gap-3">
										<span
											class:text-(--text-muted)={googleAdsStatus === 'pending'}
											class:text-(--accent)={googleAdsStatus === 'active'}
											class:text-(--text-primary)={googleAdsStatus === 'completed'}
											>{getChecklistIndicator(googleAdsStatus)}</span
										>
										<span>Generating Google Ads</span>
									</li>
									<li class="flex items-center gap-3">
										<span
											class:text-(--text-muted)={landingPageStatus === 'pending'}
											class:text-(--accent)={landingPageStatus === 'active'}
											class:text-(--text-primary)={landingPageStatus === 'completed'}
											>{getChecklistIndicator(landingPageStatus)}</span
										>
										<span>Generating landing page</span>
									</li>
								</ul>
								<p
									class="text-xs"
									class:text-(--text-muted)={!pipelineFailedTerminally}
									class:text-[#b42318]={pipelineFailedTerminally}
								>
									{latestPipelineMessage}
								</p>
							</div>
						{/if}

						<Button isSubmitting={isCreateSubmitting}>
							{#if isCreateSubmitting}
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
