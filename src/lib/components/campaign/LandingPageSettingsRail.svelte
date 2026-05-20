<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { onMount } from 'svelte';
	import { getLandingPagePreview } from '../../../routes/(app)/campaigns/[id]/landing-page/landing-page.remote';

	type GenerationJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

	type GenerationJob = {
		id: number;
		status: GenerationJobStatus;
		inputPayload: unknown;
		outputPayload: unknown;
		errorMessage: string | null;
		createdAt: string;
		completedAt: string | null;
	};

	type GenerationJobStage = {
		name: string;
		status: GenerationJobStatus;
		message: string;
		level: 'info' | 'success' | 'error';
		timestamp: string;
		meta?: Record<string, unknown>;
	};

	let { children } = $props();

	const campaignId = $derived(Number(page.params.id));
	const selectedVersion = $derived.by(() => {
		const parsed = Number(page.url.searchParams.get('version'));
		return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
	});

	const previewQuery = $derived(
		getLandingPagePreview({
			campaignId,
			version: selectedVersion
		})
	);

	const getViewData = () => previewQuery.current;
	const canRenderSelectedPage = () => Boolean(getViewData()?.canRenderPage);

	const isViewingLatestVersion = () => {
		const viewData = getViewData();
		if (!viewData) return false;
		return viewData.campaignPageId === viewData.latestCampaignPageId;
	};

	const canEditPage = () => {
		const viewData = getViewData();
		if (!viewData) return false;
		return Boolean(viewData.campaignPageId) && viewData.campaignStatus !== 'published';
	};

	const canUseAiEditor = () => canEditPage() && canRenderSelectedPage() && isViewingLatestVersion();
	const currentEditPreview = $derived(page.form?.pageEdit?.preview);
	const hasEditPreview = $derived(Boolean(currentEditPreview));
	const serializedPreviewPayload = $derived(
		currentEditPreview ? JSON.stringify(currentEditPreview) : ''
	);

	const getComposerHint = () => {
		const viewData = getViewData();
		if (!viewData) return 'Loading landing page preview...';
		if (!viewData.campaignPageId) return 'Open a campaign page version to use AI edits.';
		if (!isViewingLatestVersion()) {
			return 'You are previewing an older version. Switch to the latest version to use AI edits.';
		}
		if (viewData.campaignStatus === 'published') {
			return 'This campaign is published. Archive it before editing the landing page.';
		}
		return 'Describe text, section order, section removal, approved media swaps, or layout adjustments.';
	};

	const formatVersionDate = (date: Date) =>
		new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(date));

	const getCurrentLogoIds = () => {
		const viewData = getViewData();
		if (!viewData || !viewData.canRenderPage) return [] as string[];

		const section = viewData.page.sections.find((item) => item.type === 'logos_of_trust_ribbon');
		if (!section || !('logos' in section.props) || !Array.isArray(section.props.logos)) return [];

		const byName = new Map(
			viewData.availableLogos.map((logo) => [logo.name.trim().toLowerCase(), logo.id])
		);

		return section.props.logos
			.map((logo) => byName.get(logo.name.trim().toLowerCase()))
			.filter((id): id is string => Boolean(id));
	};

	const getCurrentKeynoteIds = () => {
		const viewData = getViewData();
		if (!viewData || !viewData.canRenderPage) return [] as string[];

		const section = viewData.page.sections.find((item) => item.type === 'keynote_speeches');
		if (!section || !('keynoteIds' in section.props) || !Array.isArray(section.props.keynoteIds))
			return [];

		return section.props.keynoteIds.filter((id): id is string => typeof id === 'string');
	};

	let busy = $state(false);
	let generationJobs = $state<GenerationJob[]>([]);
	let generationJobsLoading = $state(false);
	let generationJobsError = $state<string | null>(null);
	let expandedJobIds = $state<number[]>([]);
	let jobsRefreshTimer: ReturnType<typeof setInterval> | null = null;

	const getJobPipeline = (job: GenerationJob): string => {
		if (!job.outputPayload || typeof job.outputPayload !== 'object') {
			return 'unknown';
		}

		const pipeline = (job.outputPayload as { pipeline?: unknown }).pipeline;
		return typeof pipeline === 'string' && pipeline.trim().length > 0 ? pipeline : 'unknown';
	};

	const getJobStages = (job: GenerationJob): GenerationJobStage[] => {
		if (!job.outputPayload || typeof job.outputPayload !== 'object') {
			return [];
		}

		const stages = (job.outputPayload as { stages?: unknown }).stages;
		if (!Array.isArray(stages)) {
			return [];
		}

		return stages.filter(
			(stage): stage is GenerationJobStage =>
				typeof stage === 'object' &&
				stage !== null &&
				typeof (stage as { name?: unknown }).name === 'string' &&
				typeof (stage as { status?: unknown }).status === 'string' &&
				typeof (stage as { message?: unknown }).message === 'string' &&
				typeof (stage as { timestamp?: unknown }).timestamp === 'string' &&
				typeof (stage as { level?: unknown }).level === 'string'
		);
	};

	const getLatestJobStage = (job: GenerationJob): GenerationJobStage | null => {
		const stages = getJobStages(job);
		return stages.length > 0 ? stages[stages.length - 1] : null;
	};

	const isJobExpanded = (jobId: number): boolean => expandedJobIds.includes(jobId);

	const toggleJobExpanded = (jobId: number): void => {
		expandedJobIds = expandedJobIds.includes(jobId)
			? expandedJobIds.filter((id) => id !== jobId)
			: [...expandedJobIds, jobId];
	};

	const hasProcessingJobs = (): boolean =>
		generationJobs.some((job) => job.status === 'processing');

	const startJobsRefreshTimer = (): void => {
		if (typeof window === 'undefined' || jobsRefreshTimer) {
			return;
		}

		jobsRefreshTimer = setInterval(() => {
			if (hasProcessingJobs()) {
				void refreshGenerationJobs();
			}
		}, 5000);
	};

	const stopJobsRefreshTimer = (): void => {
		if (jobsRefreshTimer) {
			clearInterval(jobsRefreshTimer);
			jobsRefreshTimer = null;
		}
	};

	async function refreshGenerationJobs(): Promise<void> {
		if (!Number.isFinite(campaignId) || campaignId <= 0) {
			generationJobs = [];
			generationJobsError = 'Invalid campaign id for generation jobs.';
			return;
		}

		generationJobsLoading = true;
		generationJobsError = null;

		try {
			const response = await fetch(`/campaigns/${campaignId}/generation-jobs?limit=20`);
			if (!response.ok) {
				throw new Error(`Unable to load generation runs (${response.status}).`);
			}

			const payload = (await response.json()) as { jobs?: GenerationJob[] };
			generationJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
		} catch (error) {
			generationJobsError =
				error instanceof Error ? error.message : 'Unable to load generation runs.';
		} finally {
			generationJobsLoading = false;
		}
	}

	const handleEditSubmit: SubmitFunction = () => {
		busy = true;
		return async ({ result, update }) => {
			try {
				await update({ reset: true, invalidateAll: true });
				await refreshGenerationJobs();
				if (result.type === 'success') {
					const nextCampaignPageId = result.data?.pageEdit?.campaignPageId;
					if (typeof nextCampaignPageId === 'number' && Number.isFinite(nextCampaignPageId)) {
						const nextUrl = new URL(page.url);
						nextUrl.searchParams.set('version', String(nextCampaignPageId));
						await goto(nextUrl.pathname + nextUrl.search, {
							invalidateAll: true,
							keepFocus: true,
							replaceState: true
						});
					}
				}
			} finally {
				busy = false;
			}
		};
	};

	const handleRestoreSubmit: SubmitFunction = () => {
		busy = true;
		return async ({ result, update }) => {
			try {
				await update({ reset: true, invalidateAll: true });
				await refreshGenerationJobs();
				if (result.type === 'success') {
					await goto(page.url.pathname, {
						invalidateAll: true,
						keepFocus: true,
						replaceState: true
					});
				}
			} finally {
				busy = false;
			}
		};
	};

	onMount(() => {
		void refreshGenerationJobs();
		startJobsRefreshTimer();

		return () => {
			stopJobsRefreshTimer();
		};
	});
</script>

<div class="sticky top-0 h-dvh min-h-0 overflow-hidden border-l border-stone-200 bg-white">
	{#if getViewData()}
		{@const viewData = getViewData()!}
		<div class="grid h-full overflow-y-auto pb-[430px]">
			{@render children?.()}
			<section class="border border-[#d9dbcf] bg-white" aria-label="Landing page version history">
				<div class="border-b border-[#e5e7eb] p-3.5">
					<p class="m-0 text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase">
						Version history
					</p>
					<p class="mt-1 mr-0 mb-0 ml-0 text-[0.78rem] text-[#4b5563]">
						Preview and restore any previous generated version.
					</p>
				</div>
				<div class="grid max-h-[240px] overflow-auto">
					{#each viewData.versionHistory as version (version.id)}
						<a
							href={`?version=${version.id}`}
							class={[
								'flex items-center justify-between gap-2 border-b border-[#f1f5f9] px-3.5 py-[0.6rem] font-sans text-inherit no-underline',
								version.id === viewData.campaignPageId &&
									'border-l-[3px] border-l-[#0f172a] bg-[#f8fafc] pl-[calc(0.875rem-3px)]'
							]}
						>
							<div>
								<p class="m-0 text-[0.82rem] font-semibold text-[#0f172a]">
									v{version.versionNumber}
								</p>
								<p class="mt-[0.1rem] mr-0 mb-0 ml-0 text-[0.74rem] text-[#64748b]">
									{formatVersionDate(version.createdAt)}
								</p>
								{#if version.changeNote}
									<p
										class="mt-[0.2rem] mr-0 mb-0 ml-0 text-[0.74rem] leading-[1.35] text-[#334155]"
									>
										{version.changeNote}
									</p>
								{/if}
							</div>
							{#if version.id === viewData.latestCampaignPageId}
								<span
									class="bg-[#e2e8f0] px-[0.4rem] py-[0.15rem] text-[0.62rem] font-bold tracking-[0.06em] text-[#1e293b] uppercase"
									>latest</span
								>
							{/if}
						</a>
					{/each}
				</div>
				<form
					method="POST"
					use:enhance={handleRestoreSubmit}
					action="?/restoreVersion"
					class="pt-3 pr-3.5 pb-3.5 pl-3.5"
				>
					<input type="hidden" name="campaignPageId" value={viewData.campaignPageId ?? ''} />
					<button
						type="submit"
						disabled={!canEditPage() || isViewingLatestVersion() || busy}
						class="w-full cursor-pointer border border-[#0f172a] bg-[#0f172a] px-[0.9rem] py-[0.6rem] text-[0.72rem] font-bold tracking-[0.05em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-[0.55]"
					>
						{busy ? 'Restoring...' : 'Restore viewed version as latest'}
					</button>
				</form>
			</section>

			<section class="border border-[#d9dbcf] bg-white" aria-label="Generation runs">
				<div class="border-b border-[#e5e7eb] p-3.5">
					<p class="m-0 text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase">
						Generation runs
					</p>
					<p class="mt-1 mr-0 mb-0 ml-0 text-[0.78rem] text-[#4b5563]">
						Recent generation and edit jobs for this campaign.
					</p>
				</div>
				<div class="grid gap-2 p-3.5">
					<div class="flex items-center justify-between gap-2">
						<p class="m-0 text-[0.74rem] text-[#475569]">Latest 20 runs</p>
						<button
							type="button"
							onclick={() => void refreshGenerationJobs()}
							disabled={generationJobsLoading}
							class="cursor-pointer border border-[#cbd5e1] bg-white px-2 py-1 text-[0.66rem] font-semibold tracking-[0.05em] text-[#334155] uppercase disabled:cursor-not-allowed disabled:opacity-60"
						>
							{generationJobsLoading ? 'Refreshing...' : 'Refresh'}
						</button>
					</div>
					{#if generationJobsError}
						<p class="m-0 text-[0.74rem] text-[#b91c1c]">{generationJobsError}</p>
					{:else if generationJobs.length === 0}
						<p class="m-0 text-[0.74rem] text-[#64748b]">No generation runs yet.</p>
					{:else}
						<div class="grid max-h-[280px] gap-2 overflow-auto">
							{#each generationJobs as job (job.id)}
								{@const latestStage = getLatestJobStage(job)}
								<div class="border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
									<div class="flex items-start justify-between gap-2">
										<div class="grid gap-1">
											<p class="m-0 text-[0.72rem] font-semibold text-[#0f172a]">
												#{job.id} · {getJobPipeline(job)}
											</p>
											<p class="m-0 text-[0.7rem] text-[#64748b]">
												{formatVersionDate(new Date(job.createdAt))}
												{#if job.completedAt}
													· done {formatVersionDate(new Date(job.completedAt))}
												{/if}
											</p>
											<p class="m-0 text-[0.72rem] text-[#334155]">
												{latestStage?.message ?? 'No stage messages yet.'}
											</p>
										</div>
										<span
											class={[
												'px-1.5 py-0.5 text-[0.62rem] font-bold tracking-[0.05em] uppercase',
												job.status === 'completed' && 'bg-[#dcfce7] text-[#166534]',
												job.status === 'processing' && 'bg-[#dbeafe] text-[#1d4ed8]',
												job.status === 'failed' && 'bg-[#fee2e2] text-[#b91c1c]',
												job.status === 'pending' && 'bg-[#e2e8f0] text-[#334155]'
											]}
										>
											{job.status}
										</span>
									</div>
									<button
										type="button"
										onclick={() => toggleJobExpanded(job.id)}
										class="mt-2 cursor-pointer border border-[#cbd5e1] bg-white px-2 py-1 text-[0.64rem] font-semibold tracking-[0.05em] text-[#334155] uppercase"
									>
										{isJobExpanded(job.id) ? 'Hide details' : 'Show details'}
									</button>
									{#if isJobExpanded(job.id)}
										<div class="mt-2 grid gap-1.5 border-t border-[#dbe3ed] pt-2">
											{#if job.errorMessage}
												<p class="m-0 text-[0.72rem] text-[#b91c1c]">{job.errorMessage}</p>
											{/if}
											{#if getJobStages(job).length === 0}
												<p class="m-0 text-[0.72rem] text-[#64748b]">No stage timeline.</p>
											{:else}
												{#each getJobStages(job) as stage, stageIndex (`${job.id}:${stage.name}:${stageIndex}`)}
													<p class="m-0 text-[0.7rem] leading-[1.35] text-[#334155]">
														<span class="font-semibold">{stage.name}</span>
														· {stage.status}
														<br />
														{stage.message}
													</p>
												{/each}
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</section>

			{#if canRenderSelectedPage()}
				<aside class="border border-stone-200 bg-white" aria-label="Landing page logo picker">
					<form
						method="POST"
						use:enhance={handleEditSubmit}
						action="?/setLogos"
						class="flex flex-col gap-3 p-3.5"
					>
						<input type="hidden" name="campaignPageId" value={viewData.campaignPageId ?? ''} />
						<p class="m-0 text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase">
							Logos for trust ribbon
						</p>
						<div class="grid max-h-[200px] gap-2 overflow-auto">
							{#each viewData.availableLogos as logo (logo.id)}
								<label class="flex items-center gap-2 text-[0.8rem]">
									<input
										type="checkbox"
										name="logoIds"
										value={logo.id}
										checked={getCurrentLogoIds().includes(logo.id)}
										disabled={!canEditPage()}
									/>
									<img
										src={logo.logoUrl}
										alt={logo.logoAlt}
										class="h-[20px] max-w-[70px] object-contain"
									/>
									<span>{logo.name}</span>
								</label>
							{/each}
						</div>
						<button
							type="submit"
							disabled={!canEditPage()}
							class="cursor-pointer self-end border border-[#0f172a] bg-[#0f172a] px-[0.9rem] py-[0.6rem] text-[0.78rem] font-bold tracking-[0.04em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-[0.55]"
							>Save logos</button
						>
					</form>
				</aside>

				<aside class="border border-stone-200 bg-white" aria-label="Landing page keynote picker">
					<form
						method="POST"
						use:enhance={handleEditSubmit}
						action="?/setKeynotes"
						class="flex flex-col gap-3 p-3.5"
					>
						<input type="hidden" name="campaignPageId" value={viewData.campaignPageId ?? ''} />
						<p class="m-0 text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase">
							Keynotes
						</p>
						<div class="grid max-h-[260px] gap-2 overflow-auto">
							{#each viewData.availableKeynotes as keynote (keynote.id)}
								<label class="flex items-start gap-2 text-[0.8rem]">
									<input
										type="checkbox"
										name="keynoteIds"
										value={keynote.id}
										checked={getCurrentKeynoteIds().includes(keynote.id)}
										disabled={!canEditPage()}
									/>
									<img
										src={keynote.imageUrl}
										alt={keynote.imageAlt}
										class="h-[42px] w-[56px] border border-[#d1d5db] object-cover"
									/>
									<span>{keynote.title}</span>
								</label>
							{/each}
						</div>
						<button
							type="submit"
							disabled={!canEditPage()}
							class="cursor-pointer self-end border border-[#0f172a] bg-[#0f172a] px-[0.9rem] py-[0.6rem] text-[0.78rem] font-bold tracking-[0.04em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-[0.55]"
							>Save keynotes</button
						>
					</form>
				</aside>
			{/if}

			<aside class="border border-stone-200 bg-white" aria-label="Landing page editor">
				<form
					method="POST"
					use:enhance={handleEditSubmit}
					action="?/retryGeneration"
					class="flex flex-col gap-3 p-3.5"
				>
					<div class="flex flex-col items-baseline justify-between gap-3 max-[900px]:items-start">
						<p
							class="m-0 font-['Space_Grotesk',sans-serif] text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase"
						>
							Manual generation retry
						</p>
						<p class="m-0 text-[0.78rem] text-[#4b5563]">
							Use this when automatic retries were exhausted.
						</p>
					</div>
					<button
						type="submit"
						disabled={!canEditPage() || busy}
						class="cursor-pointer self-end border border-[#0f172a] bg-[#0f172a] px-[0.9rem] py-[0.6rem] text-[0.78rem] font-bold tracking-[0.04em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-[0.55] max-[900px]:justify-self-stretch"
						>{busy ? 'Retrying...' : 'Retry landing page generation'}</button
					>
				</form>

				{#if canRenderSelectedPage() && isViewingLatestVersion()}
					<!--Edit with AI panel fixed-->
					<form
						method="POST"
						use:enhance={handleEditSubmit}
						action="?/editPage"
						class="absolute inset-x-0 bottom-0 z-20 flex flex-col border-t border-stone-300 bg-white p-3.5"
					>
						<input type="hidden" name="campaignPageId" value={viewData.campaignPageId ?? ''} />
						<input type="hidden" name="preview_payload" value={serializedPreviewPayload} />
						<div class="flex flex-col items-baseline justify-between gap-3 max-[900px]:items-start">
							<p
								class="m-0 font-['Space_Grotesk',sans-serif] text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase"
							>
								Edit landing page with AI
							</p>
							<p class="m-0 text-[0.78rem] text-[#4b5563]">{getComposerHint()}</p>
						</div>
						<textarea
							value={page.form?.pageEdit?.values?.changePrompt ?? ''}
							name="change_prompt"
							rows="6"
							placeholder="e.g. Move the hero image left, make the hero more compact, and tighten the headline"
							disabled={!canUseAiEditor()}
							class="w-full resize-y border border-[#cbd5e1] bg-white px-3 py-2.5 text-[0.85rem] leading-[1.45] text-[#0f172a] disabled:bg-[#f1f5f9] disabled:text-[#64748b]"
						></textarea>
						<label class="flex items-center gap-2 text-[0.78rem] text-[#334155]">
							<input
								type="checkbox"
								name="auto_apply_simple"
								checked={page.form?.pageEdit?.values?.autoApplySimple ?? false}
							/>
							Auto-apply simple edits (single-section, no media or reordering)
						</label>
						{#if currentEditPreview}
							<div class="grid gap-2 border border-[#d9dbcf] bg-[#f8fafc] p-2.5">
								<p class="m-0 text-[0.72rem] font-bold tracking-[0.05em] text-[#0f172a] uppercase">
									Preview summary
								</p>
								<p class="m-0 text-[0.78rem] text-[#334155]">
									Operations: {currentEditPreview.operationTypes.join(', ') || 'none'}
								</p>
								<p class="m-0 text-[0.78rem] text-[#334155]">
									Impacted sections:
									{currentEditPreview.changeSummary.impactedSections.join(', ') || 'none'}
								</p>
								{#if currentEditPreview.changeSummary.layoutChanges.length > 0}
									<p class="m-0 text-[0.76rem] text-[#334155]">
										Layout changes: {currentEditPreview.changeSummary.layoutChanges.join(' ')}
									</p>
								{/if}
								{#if currentEditPreview.changeSummary.mediaChanges.length > 0}
									<p class="m-0 text-[0.76rem] text-[#334155]">
										Media changes: {currentEditPreview.changeSummary.mediaChanges.join(' ')}
									</p>
								{/if}
								{#if currentEditPreview.changeSummary.reorderedSections.length > 0}
									<p class="m-0 text-[0.76rem] text-[#334155]">
										Order changes:
										{currentEditPreview.changeSummary.reorderedSections.join(' | ')}
									</p>
								{/if}
								{#if currentEditPreview.changeSummary.fieldDiffs.length > 0}
									<div class="grid gap-1.5 border-t border-[#d1d5db] pt-2">
										<p
											class="m-0 text-[0.72rem] font-semibold tracking-[0.04em] text-[#0f172a] uppercase"
										>
											Before / after
										</p>
										{#each currentEditPreview.changeSummary.fieldDiffs as diff, index (`${diff.sectionType}:${diff.field}:${index}`)}
											<p class="m-0 text-[0.74rem] leading-[1.35] text-[#334155]">
												<span class="font-semibold">{diff.sectionType}.{diff.field}</span>
												<br />
												<code>{diff.before}</code>
												<span> -> </span>
												<code>{diff.after}</code>
											</p>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
						<button
							type="submit"
							name="mode"
							value={hasEditPreview ? 'accept' : 'preview'}
							disabled={!canUseAiEditor() || busy}
							class="cursor-pointer self-end border border-[#0f172a] bg-[#0f172a] px-[0.9rem] py-[0.6rem] text-[0.78rem] font-bold tracking-[0.04em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-[0.55] max-[900px]:justify-self-stretch"
							>{busy
								? 'Working...'
								: hasEditPreview
									? 'Accept and save preview'
									: 'Generate preview'}
						</button>
						{#if hasEditPreview}
							<button
								type="submit"
								name="mode"
								value="reject"
								disabled={busy}
								class="mt-2 cursor-pointer self-start border border-[#94a3b8] bg-white px-[0.9rem] py-[0.55rem] text-[0.74rem] font-semibold tracking-[0.03em] text-[#334155] uppercase disabled:cursor-not-allowed disabled:opacity-[0.55]"
							>
								Discard preview
							</button>
						{/if}
						{#if page.form?.pageEdit}
							<p
								class={[
									'm-0 text-[0.8rem] text-[#b91c1c]',
									(page.form?.pageEdit?.success ?? false) && 'text-[#166534]'
								]}
							>
								{page.form?.pageEdit?.message ?? ''}
							</p>
						{/if}
					</form>
				{:else}
					<div class="flex flex-col gap-3 border-t border-[#e5e7eb] p-3.5">
						<p
							class="m-0 font-['Space_Grotesk',sans-serif] text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase"
						>
							Edit landing page with AI
						</p>
						<p class="m-0 text-[0.78rem] leading-[1.45] text-[#4b5563]">
							{canRenderSelectedPage()
								? getComposerHint()
								: 'This version cannot be edited because its content is incomplete.'}
						</p>
					</div>
				{/if}
				<!--/Edit with AI panel fixed-->
			</aside>
		</div>
	{:else}
		<div class="p-6 text-sm text-slate-600">Loading landing page settings...</div>
	{/if}
</div>
