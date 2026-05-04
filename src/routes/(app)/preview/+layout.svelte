<script lang="ts">
	import { page } from '$app/stores';
	import AdminSidebar, { type AdminSidebarNavItem } from '$lib/components/AdminSidebar.svelte';

	let { children } = $props();

	type PreviewSidebarData = {
		campaignId?: number | null;
	};

	const sidebarData = $derived(($page.data as PreviewSidebarData) ?? {});
	const campaignId = $derived(sidebarData.campaignId ?? null);

	const navItems = $derived.by<readonly AdminSidebarNavItem[]>(() => [
		{
			label: 'Ads',
			href: campaignId ? `/campaigns/${campaignId}` : undefined,
			match: 'prefix',
			disabled: !campaignId,
			icon: 'mdi--google-ads'
		},
		{
			label: 'Landing Page Preview',
			href: campaignId ? `/campaigns/${campaignId}/landing-page` : undefined,
			match: 'prefix',
			disabled: !campaignId,
			icon: 'mdi--page-layout-header'
		},
		{
			label: 'Analytics',
			href: campaignId ? `/campaigns/${campaignId}/analytics` : undefined,
			match: 'prefix',
			disabled: !campaignId,
			icon: 'mdi--chart-areaspline'
		},
		{ label: 'History', disabled: true }
	]);
</script>

<div class="preview-layout">
	<div class="hidden lg:block">
		<AdminSidebar title="Campaign Console" subtitle="Operational Navigation" {navItems} />
	</div>
	<div class="preview-content">
		{@render children()}
	</div>
</div>

<style>
	.preview-layout {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
		gap: 2rem;
		padding: 0 3rem 3rem;
	}

	.preview-content {
		min-width: 0;
	}

	@media (max-width: 1200px) {
		.preview-layout {
			grid-template-columns: 1fr;
			padding: 0.5rem;
		}
	}
</style>
