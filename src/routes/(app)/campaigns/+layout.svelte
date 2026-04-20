<script lang="ts">
	import { page } from '$app/stores';
	import AdminSidebar, { type AdminSidebarNavItem } from '$lib/components/AdminSidebar.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { children } = $props();

	type CampaignSidebarData = {
		campaign?: {
			id: number;
			status?: string;
		};
		campaignPageId?: number | null;
	};

	const isDetailRoute = $derived(/^\/campaigns\/\d+(?:\/analytics)?$/.test($page.url.pathname));
	const sidebarData = $derived(($page.data as CampaignSidebarData) ?? {});
	const campaign = $derived(sidebarData.campaign ?? null);
	const campaignPageId = $derived(sidebarData.campaignPageId ?? null);

	const targetStatus = (status?: string) => (status === 'published' ? 'draft' : 'published');

	const navItems = $derived.by<readonly AdminSidebarNavItem[]>(() => {
		if (isDetailRoute && campaign) {
			const previewHref = campaignPageId
				? `/preview/landing-page?campaignPageId=${campaignPageId}`
				: undefined;

			return [
				{ label: 'Ads', href: `/campaigns/${campaign.id}`, match: 'exact' },
				{
					label: 'Landing Page Preview',
					href: previewHref,
					match: 'prefix',
					disabled: !previewHref
				},
				{ label: 'Analytics', href: `/campaigns/${campaign.id}/analytics`, match: 'prefix' },
				{ label: 'History', disabled: true }
			];
		}

		return [
			{ label: 'Library', href: '/campaigns', match: 'prefix' },
			{ label: 'Analytics', href: '/campaigns/analytics', match: 'prefix' }
		];
	});
</script>

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
				{campaign.status === 'published' ? 'Unpublish' : 'Publish Campaign'}
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

	@media (max-width: 1200px) {
		.campaign-layout {
			grid-template-columns: 1fr;
			padding: 0.5rem;
		}
	}
</style>
