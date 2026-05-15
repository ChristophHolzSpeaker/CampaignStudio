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
			campaignPageId?: number | null;
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
	const getActiveCampaignPageId = () => getUpdatedPageId() ?? getPageData().campaignPageId ?? null;
	const getDuplicateName = () => {
		const name = getCampaign()?.name?.trim();
		return name?.length ? `${name} Copy` : 'Campaign Copy';
	};

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
	const targetStatus = (status?: string) => (status === 'published' ? 'archived' : 'published');
	const publishLabel = (status?: string) =>
		status === 'published' ? 'Archive' : 'Publish campaign';
</script>

<section class="bookings-content space-y-8 p-6 lg:p-10">
	<div class="mx-auto grid grid-cols-12 gap-10">
		<!-- Right Column: Ad Groups List -->
		<section class="col-span-12">
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
	.duplicate-campaign-form {
		margin-top: 1rem;
		display: grid;
		gap: 0.5rem;
	}

	.duplicate-campaign-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5rem;
		align-items: end;
	}

	.duplicate-campaign-input {
		border: 1px solid #e2e8f0;
		background: #ffffff;
		padding: 0.45rem 0.6rem;
		font-size: 0.8rem;
		color: #0f172a;
	}

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
