<script lang="ts">
	import NavButton from '$lib/components/elements/NavButton.svelte';
	import CampaignCard from '$lib/components/CampaignCard.svelte';
	import AdminSidebar from '$lib/components/AdminSidebar.svelte';

	const { data } = $props();

	const campaigns = $derived.by(() => data?.campaignList ?? []);

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
			<p class="max-w-[32rem] text-[0.95rem] text-[#5d3f3f]">
				Track every named campaign and keep each audience, format, and topic aligned with the brand
				voice. Publish what’s ready, keep drafts private, and preview work before it goes live.
			</p>
		</div>
		<div class="self-start">
			<div class="flex items-center gap-4">
				<NavButton href="/campaign/new">New campaign</NavButton>
			</div>
		</div>
	</div>

	{#if campaigns.length === 0}
		<div class="vertical-xl text-center">
			<p class="text-muted-foreground">
				You haven’t created any campaigns yet. Start a new campaign to begin capturing briefs,
				audience insights, and launch content.
			</p>
			<NavButton href="/campaign/new">Create first campaign</NavButton>
		</div>
	{:else}
		<section class="campaign-grid">
			{#each campaigns as campaign (campaign.id)}
				<form method="POST" action="?/publish" class="campaign-shell">
					<input type="hidden" name="id" value={campaign.id} />
					<input type="hidden" name="target_status" value={targetStatus(campaign.status)} />
					<CampaignCard {campaign} />
					<div class="card-actions px-6">
						<button type="submit" class="toggle-button">{publishLabel(campaign.status)}</button>
						<button
							type="button"
							class="outline-link"
							onclick={() => window.location.assign(`/campaigns/${campaign.id}`)}
						>
							Edit
						</button>
					</div>
				</form>
			{/each}
		</section>
	{/if}
</section>

<style>
	.campaign-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1rem;
		padding: 0 0 3rem;
	}

	.campaign-shell {
		background: #ffffff;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.toggle-button {
		background: transparent;
		color: #b8002a;
		border: 0;
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.card-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.campaign-shell .outline-link {
		color: inherit;
		text-decoration: underline;
	}
</style>
