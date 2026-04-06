<script lang="ts">
	import AdminSidebar from '$lib/components/AdminSidebar.svelte';
	import AdGroupCard from '$lib/components/blocks/AdGroupCard.svelte';
	import type {
		CampaignAdGroupWithDetails,
		CampaignAdPackageWithDetails,
		CampaignRecord
	} from '$lib/server/campaigns/client';

	let { data } = $props();

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
			adGroups?: CampaignAdGroupWithDetails[];
			adPackage?: CampaignAdPackageWithDetails | null;
		};

	const getCampaign = () => getPageData().campaign ?? null;
	const getAdGroups = () => getPageData().adGroups ?? [];
	const getAdPackage = () => getPageData().adPackage ?? null;
	const getPackageId = () => getAdPackage()?.id ?? '—';
	const getPackageVersionLabel = () => {
		const pkg = getAdPackage();
		return pkg ? `v${pkg.version_number}` : '—';
	};
</script>

<div class="hidden self-start lg:block">
	<AdminSidebar />
</div>
<section class="flex flex-col gap-6 p-6 lg:p-10">
	<div class="mx-auto grid max-w-7xl grid-cols-12 gap-10">
		<!-- Left Column: Campaign Summary -->
		<section class="col-span-12 space-y-8 lg:col-span-4">
			<div class="sticky top-24">
				<header class="mb-10">
					<div class="mb-4 flex items-center gap-2">
						<span
							class="bg-primary-fixed text-on-primary-fixed-variant rounded py-1 font-['Space_Grotesk'] text-[10px] font-bold tracking-widest uppercase"
						>
							{(getCampaign()?.status ?? 'draft').toUpperCase()}
						</span>
						<span
							class="font-['Space_Grotesk'] text-[10px] font-medium tracking-widest text-slate-400 uppercase"
						>
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
							class="mb-2 block font-['Space_Grotesk'] text-[10px] font-bold tracking-widest text-primary uppercase"
						>
							Campaign Metadata
						</span>
						<div class="grid grid-cols-2 gap-4">
							<div
								class="rounded bg-surface-container-lowest p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
							>
								<span
									class="mb-1 block text-[9px] font-bold tracking-widest text-slate-400 uppercase"
									>Package ID</span
								>
								<span class="font-['Space_Grotesk'] text-sm font-bold text-on-surface">
									{getPackageId()}
								</span>
							</div>
							<div
								class="rounded bg-surface-container-lowest p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
							>
								<span
									class="mb-1 block text-[9px] font-bold tracking-widest text-slate-400 uppercase"
									>Version</span
								>
								<span class="font-['Space_Grotesk'] text-sm font-bold text-on-surface">
									{getPackageVersionLabel()}
								</span>
							</div>
						</div>
					</div>
					<div>
						<span
							class="mb-2 block font-['Space_Grotesk'] text-[10px] font-bold tracking-widest text-primary uppercase"
							>Primary Channel</span
						>
						<div
							class="flex items-center gap-4 rounded bg-surface-container-lowest p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
						>
							<span class="material-symbols--search-rounded"></span>
							<div>
								<span class="block leading-tight font-bold text-on-surface">
									{getAdPackage()?.channel ?? 'Google Ads Search'}
								</span>
								<span
									class="font-['Space_Grotesk'] text-[10px] tracking-widest text-slate-400 uppercase"
									>{getCampaign()?.format ?? 'Text & Dynamic Search'}</span
								>
							</div>
						</div>
					</div>
					<div class="pt-4">
						<button
							class="w-full rounded-md bg-on-surface py-4 font-['Space_Grotesk'] text-sm font-bold tracking-widest text-surface uppercase transition-colors hover:bg-slate-800"
						>
							Publish Campaign
						</button>
						<button
							class="mt-3 w-full py-2 font-['Space_Grotesk'] text-xs font-bold tracking-widest text-primary uppercase transition-opacity hover:opacity-80"
						>
							Export Draft (.json)
						</button>
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
