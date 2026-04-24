<script lang="ts">
	import AdGroupCard from '$lib/components/blocks/AdGroupCard.svelte';
	import { strategyEntries } from '$lib/utils/strategy';
	import type { PageProps } from './$types';
	import type {
		CampaignAdGroupWithDetails,
		CampaignAdPackageWithDetails,
		CampaignRecord
	} from '$lib/server/campaigns/client';
	import type { CampaignVisitMetrics } from '$lib/validation/campaign-visit-metrics';
	import Button from '$lib/components/elements/Button.svelte';
	import { applyAction, enhance } from '$app/forms';

	type StrategyUpdateState = {
		values: {
			strategyPrompt: string;
		};
		message?: string;
		success?: boolean;
		adPackageId?: number;
		campaignPageId?: number;
	};

	let { data, form }: PageProps = $props();

	const formatFriendlyDate = (value?: Date | string) => {
		if (!value) return 'Pending';
		const date = typeof value === 'string' ? new Date(value) : value;
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(date);
	};

	const getPageData = () =>
		data as {
			campaign?: CampaignRecord;
			visitMetrics?: CampaignVisitMetrics | null;
			adGroups?: CampaignAdGroupWithDetails[];
			adPackage?: CampaignAdPackageWithDetails | null;
			liveLandingUrl?: string | null;
		};

	const getCampaign = () => getPageData().campaign ?? null;
	const getVisitMetrics = (): CampaignVisitMetrics =>
		getPageData().visitMetrics ?? {
			campaignId: getCampaign()?.id ?? 0,
			visitCount: 0,
			uniqueVisitorCount: 0,
			lastVisitedAt: null
		};
	const getVisitCount = () => getVisitMetrics().visitCount ?? 0;
	const getUniqueVisitors = () => getVisitMetrics().uniqueVisitorCount ?? 0;
	const getLastVisit = () => getVisitMetrics().lastVisitedAt ?? null;
	const getAdGroups = () => getPageData().adGroups ?? [];
	const getAdPackage = () => getPageData().adPackage ?? null;
	const getLiveLandingUrl = () => getPageData().liveLandingUrl ?? null;
	const getPackageId = () => getAdPackage()?.id ?? '—';
	const getPackageVersionLabel = () => {
		const pkg = getAdPackage();
		return pkg ? `v${pkg.version_number}` : '—';
	};
	const getStrategyEntries = () => strategyEntries(getAdPackage()?.strategy_json ?? null);
	const getStrategyUpdateState = (): StrategyUpdateState | null => {
		const actionData = form as { strategyUpdate?: StrategyUpdateState } | null | undefined;
		return actionData?.strategyUpdate ?? null;
	};
	const isStrategyUpdateSuccess = () => getStrategyUpdateState()?.success === true;
	const getStrategyMessage = () => getStrategyUpdateState()?.message ?? null;
	const getStrategyPromptValue = () => {
		const state = getStrategyUpdateState();

		if (!state || state.success === true) {
			return '';
		}

		return state.values.strategyPrompt;
	};
	const getUpdatedPackageId = () => getStrategyUpdateState()?.adPackageId ?? null;
	const getUpdatedPageId = () => getStrategyUpdateState()?.campaignPageId ?? null;

	let copyStatus = $state<'idle' | 'copied' | 'error'>('idle');
	let busy = $state(false);

	const copyLiveLandingUrl = async () => {
		busy = true;
		const liveLandingUrl = getLiveLandingUrl();

		if (!liveLandingUrl) {
			copyStatus = 'error';
			return;
		}

		if (typeof navigator === 'undefined' || !navigator.clipboard) {
			copyStatus = 'error';
			return;
		}

		try {
			await navigator.clipboard.writeText(liveLandingUrl);
			copyStatus = 'copied';
		} catch {
			copyStatus = 'error';
		}
		busy = false;
	};
</script>

<section class="flex flex-col gap-6 p-6 lg:p-10">
	<div class="mx-auto grid max-w-7xl grid-cols-12 gap-10">
		<!-- Left Column: Campaign Summary -->
		<section class="col-span-12 space-y-8 lg:col-span-4">
			<div class="sticky top-24">
				<header class="mb-10">
					<div class="mb-4 flex items-center gap-2">
						<span
							class="rounded px-3 py-1 font-['Space_Grotesk'] text-[10px] font-bold text-white uppercase"
							class:bg-sky-400={getCampaign()?.status === 'draft'}
							class:bg-green-400={getCampaign()?.status === 'published'}
						>
							{(getCampaign()?.status ?? 'draft').toUpperCase()}
						</span>
						<span class="font-['Space_Grotesk'] text-[10px] font-medium text-slate-400 uppercase">
							Created {formatFriendlyDate(getCampaign()?.created_at)}
						</span>
					</div>
					<h1 class="mb-2 text-5xl leading-tight font-extrabold tracking-tighter text-on-surface">
						{getCampaign()?.name ?? 'Campaign overview'}
					</h1>
					<p class="font-medium text-slate-500">
						{getCampaign()?.topic ?? 'Campaign topic pending.'}
						{getCampaign()?.audience ? ` · ${getCampaign()?.audience}` : ''}
					</p>
				</header>
				<div class="space-y-8 rounded-xl bg-stone-100 p-8">
					<div>
						<span
							class="mb-2 block font-['Space_Grotesk'] text-[10px] font-bold text-primary uppercase"
						>
							Campaign Strategy
						</span>
						{#if getStrategyEntries().length === 0}
							<p class="text-xs text-slate-500 italic">
								Strategy data will appear here once it is available.
							</p>
						{:else}
							<div class="space-y-2 text-sm text-slate-600">
								{#each getStrategyEntries() as entry (entry.key)}
									<p class="grid grid-cols-3 gap-4 text-xs">
										<span class="font-semibold text-slate-500">{entry.key}</span>
										<span class="col-span-2 font-['Space_Grotesk'] text-[11px] text-slate-900"
											>{entry.value}</span
										>
									</p>
								{/each}
							</div>
						{/if}
						<form
							method="POST"
							action="?/updateStrategy"
							use:enhance={() => {
								busy = true;
								return async ({ result }) => {
									await applyAction(result);
									busy = false;
								};
							}}
							class="mt-4 space-y-3"
						>
							<input type="hidden" name="id" value={getCampaign()?.id ?? ''} />
							<label
								for="strategy-prompt"
								class="block font-['Space_Grotesk'] text-[10px] font-bold text-slate-500 uppercase"
							>
								Strategy edit prompt
							</label>
							<textarea
								id="strategy-prompt"
								name="strategy_prompt"
								rows="4"
								class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-[0_2px_12px_rgba(0,0,0,0.02)] focus:border-slate-300 focus:outline-none"
								placeholder="Describe how you'd like to refine the strategy..."
								>{getStrategyPromptValue()}</textarea
							>

							<Button variant="dark">Update Strategy + Regenerate</Button>
							{#if getStrategyMessage()}
								<p
									class="text-xs font-medium"
									class:text-green-600={isStrategyUpdateSuccess()}
									class:text-red-500={!isStrategyUpdateSuccess()}
								>
									{getStrategyMessage()}
								</p>
							{/if}
							{#if isStrategyUpdateSuccess() && (getUpdatedPackageId() || getUpdatedPageId())}
								<p class="font-['Space_Grotesk'] text-[10px] text-slate-500 uppercase">
									{#if getUpdatedPackageId()}New package: {getUpdatedPackageId()}{/if}
									{#if getUpdatedPackageId() && getUpdatedPageId()}
										·
									{/if}
									{#if getUpdatedPageId()}New page: {getUpdatedPageId()}{/if}
								</p>
							{/if}
						</form>
					</div>
					<div>
						<span
							class="mb-2 block font-['Space_Grotesk'] text-[10px] font-bold text-primary uppercase"
						>
							Campaign Metadata
						</span>
						<div class="grid grid-cols-2 gap-4">
							<div class="rounded bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
								<span class="mb-1 block text-[9px] font-bold text-slate-400 uppercase"
									>Package ID</span
								>
								<span class="font-['Space_Grotesk'] text-sm font-bold text-on-surface">
									{getPackageId()}
								</span>
							</div>
							<div class="rounded bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
								<span class="mb-1 block text-[9px] font-bold text-slate-400 uppercase">Version</span
								>
								<span class="font-['Space_Grotesk'] text-sm font-bold text-on-surface">
									{getPackageVersionLabel()}
								</span>
							</div>
							<div class="rounded bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
								<span class="mb-1 block text-[9px] font-bold text-slate-400 uppercase"
									>Visit count</span
								>
								<span class="font-['Space_Grotesk'] text-sm font-bold text-on-surface">
									{getVisitCount()}
								</span>
							</div>
							<div class="rounded bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
								<span class="mb-1 block text-[9px] font-bold text-slate-400 uppercase"
									>Unique visitors</span
								>
								<span class="font-['Space_Grotesk'] text-sm font-bold text-on-surface">
									{getUniqueVisitors()}
								</span>
							</div>
							<div class="rounded bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
								<span class="mb-1 block text-[9px] font-bold text-slate-400 uppercase"
									>Last visit</span
								>
								<span class="font-['Space_Grotesk'] text-sm font-bold text-on-surface">
									{getLastVisit() ? formatFriendlyDate(getLastVisit() ?? undefined) : 'Pending'}
								</span>
							</div>
						</div>
					</div>
					{#if getCampaign()?.status === 'published'}
						<div>
							<span
								class="mb-2 block font-['Space_Grotesk'] text-[10px] font-bold text-primary uppercase"
							>
								Live Landing Page
							</span>
							{#if getLiveLandingUrl()}
								<div class="space-y-3 rounded bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
									<p class="font-['Space_Grotesk'] text-[11px] break-all text-slate-700">
										{getLiveLandingUrl()}
									</p>
									<Button
										onclick={copyLiveLandingUrl}
										isSubmitting={busy}
										type="button"
										variant="dark">{copyStatus === 'copied' ? 'Copied' : 'Copy link'}</Button
									>
									{#if copyStatus === 'error'}
										<p class="text-[11px] text-red-500">
											Couldn't copy automatically. Copy it manually.
										</p>
									{/if}
								</div>
							{:else}
								<p class="text-xs text-slate-500 italic">
									Live URL will appear once the landing page slug is available.
								</p>
							{/if}
						</div>
					{/if}
					<div>
						<span
							class="mb-2 block font-['Space_Grotesk'] text-[10px] font-bold text-primary uppercase"
							>Primary Channel</span
						>
						<div
							class="flex items-center gap-4 rounded bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
						>
							<span class="material-symbols--search-rounded"></span>
							<div>
								<span class="block leading-tight font-bold text-on-surface">
									{getAdPackage()?.channel ?? 'Google Ads Search'}
								</span>
								<span class="font-['Space_Grotesk'] text-[10px] text-slate-400 uppercase"
									>{getCampaign()?.format ?? 'Text & Dynamic Search'}</span
								>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
		<!-- Right Column: Ad Groups List -->
		<section class="col-span-12 lg:col-span-8">
			<div class="mb-8 flex items-center justify-between">
				<h2 class="text-2xl font-bold tracking-tight">Ad Groups</h2>
			</div>
			<div class="space-y-12">
				{#if getAdGroups().length === 0}
					<p class="text-sm text-slate-500 italic">No ad groups available for this campaign yet.</p>
				{:else}
					{#each getAdGroups() as adGroup (adGroup.id)}
						<AdGroupCard {...adGroup} />
					{/each}
				{/if}
			</div>
		</section>
	</div>
</section>

<style>
	.material-symbols--search-rounded {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9.5 16q-2.725 0-4.612-1.888T3 9.5t1.888-4.612T9.5 3t4.613 1.888T16 9.5q0 1.1-.35 2.075T14.7 13.3l5.6 5.6q.275.275.275.7t-.275.7t-.7.275t-.7-.275l-5.6-5.6q-.75.6-1.725.95T9.5 16m0-2q1.875 0 3.188-1.312T14 9.5t-1.312-3.187T9.5 5T6.313 6.313T5 9.5t1.313 3.188T9.5 14'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
