<script lang="ts">
	import { page } from '$app/stores';
	import AdminSidebar, { type AdminSidebarNavItem } from '$lib/components/AdminSidebar.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { children } = $props();

	type CampaignSidebarData = {
		campaign?: {
			id: number;
			name?: string;
			status?: string;
		};
		campaignPageId?: number | null;
	};

	const isDetailRoute = $derived(/^\/campaigns\/\d+(?:\/.*)?$/.test($page.url.pathname));
	const sidebarData = $derived(($page.data as CampaignSidebarData) ?? {});
	const campaign = $derived(sidebarData.campaign ?? null);
	const campaignPageId = $derived(sidebarData.campaignPageId ?? null);

	const targetStatus = (status?: string) => (status === 'published' ? 'archived' : 'published');

	const navItems = $derived.by<readonly AdminSidebarNavItem[]>(() => {
		if (isDetailRoute && campaign) {
			const previewHref = campaignPageId ? `/campaigns/${campaign.id}/landing-page` : undefined;

			return [
				{
					label: 'All Campaigns',
					href: '/campaigns',
					match: 'exact',
					icon: 'material-symbols--arrow-back'
				},
				{
					label: 'Ads',
					href: `/campaigns/${campaign.id}`,
					match: 'exact',
					icon: 'mdi--google-ads'
				},
				{
					label: 'Landing Page Preview',
					href: previewHref,
					match: 'prefix',
					disabled: !previewHref,
					icon: 'mdi--page-layout-header'
				},
				{
					icon: 'mdi--chart-areaspline',
					label: 'Analytics',
					href: `/campaigns/${campaign.id}/analytics`,
					match: 'prefix'
				},
				{ label: 'History', disabled: true }
			];
		}

		return [
			{ label: 'Library', href: '/campaigns', match: 'exact', icon: 'material-symbols--book' },
			{
				label: 'Analytics',
				href: '/campaigns/analytics',
				match: 'exact',
				icon: 'mdi--chart-areaspline'
			}
		];
	});
</script>

{#snippet headerContent()}
	{#if isDetailRoute && campaign}
		<div class="campaign-context">
			<span
				class="campaign-context-status"
				class:campaign-context-status--draft={campaign.status === 'draft'}
				class:campaign-context-status--published={campaign.status === 'published'}
				class:campaign-context-status--archived={campaign.status === 'archived'}
			>
				{(campaign.status ?? 'draft').toUpperCase()}
			</span>
			<p class="campaign-context-name">{campaign.name ?? `Campaign #${campaign.id}`}</p>
		</div>
	{/if}
{/snippet}

{#snippet primaryAction()}
	{#if isDetailRoute && campaign}
		<form
			method="POST"
			action={`/campaigns/${campaign.id}?/publish`}
			class="campaign-sidebar-action"
		>
			<input type="hidden" name="id" value={campaign.id} />
			<input type="hidden" name="target_status" value={targetStatus(campaign.status)} />
			<button type="submit" class="btn-dark">
				{campaign.status === 'published' ? 'Archive' : 'Publish Campaign'}
			</button>
		</form>
	{:else}
		<NavButton href="/campaign/new">New Campaign</NavButton>
	{/if}
{/snippet}

<div class="campaign-layout">
	<div class="hidden lg:block">
		<AdminSidebar
			title="Campaign Console"
			subtitle="Operational Navigation"
			{headerContent}
			{navItems}
			{primaryAction}
		/>
	</div>
	<div class="campaign-content">
		{@render children()}
	</div>
</div>

<style>
	.campaign-layout {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
		gap: 2rem;
		padding: 0 3rem 3rem;
	}

	.campaign-content {
		min-width: 0;
	}

	.campaign-sidebar-action {
		display: grid;
	}

	.campaign-context {
		display: grid;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.12);
	}

	.campaign-context-status {
		display: inline-flex;
		width: fit-content;
		padding: 0.15rem 0.5rem;
		border-radius: 0.25rem;
		font-family: 'Space Grotesk', sans-serif;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.campaign-context-status--draft {
		background: #e0f2fe;
		color: #0369a1;
	}

	.campaign-context-status--published {
		background: #dcfce7;
		color: #166534;
	}

	.campaign-context-status--archived {
		background: #e5e7eb;
		color: #374151;
	}

	.campaign-context-name {
		margin: 0;
		font-family: 'Space Grotesk', sans-serif;
		font-size: 0.925rem;
		font-weight: 700;
		line-height: 1.35;
		color: #0f172a;
	}

	@media (max-width: 1200px) {
		.campaign-layout {
			grid-template-columns: 1fr;
			padding: 0.5rem;
		}
	}
</style>
