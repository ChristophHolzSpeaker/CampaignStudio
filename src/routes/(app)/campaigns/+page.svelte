<script lang="ts">
	import NavButton from '$lib/components/elements/NavButton.svelte';
	import CampaignCard from '$lib/components/CampaignCard.svelte';
	import AdminSidebar from '$lib/components/AdminSidebar.svelte';
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { flip } from 'svelte/animate';

	const { data } = $props();

	const campaigns = $derived.by(() => data?.campaignList ?? []);
	let formatFilter = $state('');
	let audienceFilter = $state('');
	let statusFilter = $state('');
	let geographyFilter = $state('');
	let languageFilter = $state('');

	const formatOptions = $derived.by(() =>
		Array.from(new Set(campaigns.map((campaign) => campaign.format).filter(Boolean)))
	);
	const audienceOptions = $derived.by(() =>
		Array.from(new Set(campaigns.map((campaign) => campaign.audience).filter(Boolean)))
	);
	const statusOptions = $derived.by(() =>
		Array.from(new Set(campaigns.map((campaign) => campaign.status).filter(Boolean)))
	);
	const geographyOptions = $derived.by(() =>
		Array.from(new Set(campaigns.map((campaign) => campaign.geography).filter(Boolean)))
	);
	const languageOptions = $derived.by(() =>
		Array.from(new Set(campaigns.map((campaign) => campaign.language).filter(Boolean)))
	);

	const hasActiveFilters = $derived.by(() =>
		Boolean(formatFilter || audienceFilter || statusFilter || geographyFilter || languageFilter)
	);
	const filteredCampaigns = $derived.by(() =>
		campaigns.filter((campaign) => {
			if (formatFilter && campaign.format !== formatFilter) return false;
			if (audienceFilter && campaign.audience !== audienceFilter) return false;
			if (statusFilter && campaign.status !== statusFilter) return false;
			if (geographyFilter && campaign.geography !== geographyFilter) return false;
			if (languageFilter && campaign.language !== languageFilter) return false;
			return true;
		})
	);
	const flipParams = $derived.by(() => ({
		duration: browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220
	}));

	const clearFilters = () => {
		formatFilter = '';
		audienceFilter = '';
		statusFilter = '';
		geographyFilter = '';
		languageFilter = '';
	};

	const publishLabel = (status?: string) =>
		status === 'published' ? 'Revert to draft' : 'Publish campaign';
	const targetStatus = (status?: string) => (status === 'published' ? 'draft' : 'published');
</script>

<svelte:head>
	<title>Campaign Studio • Campaigns</title>
</svelte:head>
<div class="hidden self-start lg:block">
	<AdminSidebar />
</div>

<section class="flex flex-col gap-6 p-6 lg:p-10">
	<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
		<div class="space-y-2">
			<div class="flex items-center gap-1 text-[0.7rem] tracking-[0.3em] text-[#777] uppercase">
				<span>Campaigns</span>
				<span class="text-[1rem] text-[var(--accent)]">›</span>
				<span>Studio</span>
			</div>
			<h1 class="mt-1 text-[3.5rem] tracking-[-0.03em]">
				Campaigns<span class="text-[var(--accent)]">.</span>
			</h1>
		</div>
		<div class="self-start">
			<div class="flex items-center gap-4">
				<NavButton href="/campaign/new">New campaign</NavButton>
			</div>
		</div>
	</div>
	<div class="filter-shell sticky top-18 z-10">
		<div class="filter-grid">
			<label class="filter-field">
				<span>Format</span>
				<select bind:value={formatFilter}>
					<option value="">All formats</option>
					{#each formatOptions as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</label>

			<label class="filter-field">
				<span>Audience</span>
				<select bind:value={audienceFilter}>
					<option value="">All audiences</option>
					{#each audienceOptions as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</label>

			<label class="filter-field">
				<span>Status</span>
				<select bind:value={statusFilter}>
					<option value="">All statuses</option>
					{#each statusOptions as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</label>

			<label class="filter-field">
				<span>Geography</span>
				<select bind:value={geographyFilter}>
					<option value="">All geographies</option>
					{#each geographyOptions as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</label>

			<label class="filter-field">
				<span>Language</span>
				<select bind:value={languageFilter}>
					<option value="">All languages</option>
					{#each languageOptions as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</label>
		</div>

		{#if hasActiveFilters}
			<button type="button" class="clear-filters" onclick={clearFilters}>Clear filters</button>
		{/if}
	</div>

	{#if campaigns.length === 0}
		<div class="vertical-xl text-center">
			<p class="text-muted-foreground">
				You haven’t created any campaigns yet. Start a new campaign to begin capturing briefs,
				audience insights, and launch content.
			</p>
			<NavButton href="/campaign/new">Create first campaign</NavButton>
		</div>
	{:else if filteredCampaigns.length === 0}
		<div class="vertical-xl text-center">
			<p class="text-muted-foreground">No campaigns match your current filters.</p>
			<button type="button" class="btn" onclick={clearFilters}>Reset filters</button>
		</div>
	{:else}
		<section class="grid gap-20">
			{#each filteredCampaigns as campaign (campaign.id)}
				<form
					method="POST"
					action="?/publish"
					use:enhance
					animate:flip={flipParams}
					class="campaign-shell"
				>
					<input type="hidden" name="id" value={campaign.id} />
					<input type="hidden" name="target_status" value={targetStatus(campaign.status)} />
					<CampaignCard {campaign} />
					<div class=" flex gap-4 border-b border-stone-200 px-6 pb-10">
						<button type="submit" class="btn text-primary"
							><span
								class="relative top-0.5"
								class:mdi--publish={campaign.status === 'draft'}
								class:mdi--publish-off={campaign.status === 'published'}
							></span>{publishLabel(campaign.status)}</button
						>
						<button
							type="button"
							class="btn"
							onclick={() => window.location.assign(`/campaigns/${campaign.id}`)}
						>
							<span class="material-symbols--edit-note relative top-1"></span> Edit
						</button>
					</div>
				</form>
			{/each}
		</section>
	{/if}
</section>

<style>
	.mdi--publish {
		display: inline-block;
		width: 18px;
		height: 18px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M5 4v2h14V4zm0 10h4v6h6v-6h4l-7-7z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
	.mdi--publish-off {
		display: inline-block;
		width: 18px;
		height: 18px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M20.8 22.7L15 16.9V20H9v-6H5l3.6-3.6L1.1 3l1.3-1.3l19.7 19.7zM19 6V4H7.2l2 2zm-1.8 8H19l-7-7l-.9.9z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
	.campaign-shell {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.filter-shell {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem;
		background: #ffffff;
	}

	.filter-grid {
		display: grid;
		grid-template-columns: repeat(1, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.filter-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.filter-field span {
		font-family: 'Bureau Grot', 'Space Grotesk', sans-serif;
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #5d3f3f;
	}

	.filter-field select {
		border: 1px solid #e7e5e4;
		background: #ffffff;
		padding: 0.6rem 0.65rem;
		font-size: 0.85rem;
	}

	.clear-filters {
		width: fit-content;
		border: 0;
		background: transparent;
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #b8002a;
		cursor: pointer;
	}

	@media (min-width: 768px) {
		.filter-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (min-width: 1200px) {
		.filter-grid {
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
	}

	.material-symbols--edit-note {
		display: inline-block;
		width: 18px;
		height: 18px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M4 14v-2h7v2zm0-4V8h11v2zm0-4V4h11v2zm9 14v-3.075l5.525-5.5q.225-.225.5-.325t.55-.1q.3 0 .575.113t.5.337l.925.925q.2.225.313.5t.112.55t-.1.563t-.325.512l-5.5 5.5zm6.575-5.6l.925-.975l-.925-.925l-.95.95z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
