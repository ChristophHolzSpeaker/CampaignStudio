<script lang="ts">
	import AdminSidebar, { type AdminSidebarNavItem } from '$lib/components/AdminSidebar.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { children } = $props();

	const navItems: readonly AdminSidebarNavItem[] = [
		{ label: 'Library', href: '/campaigns', match: 'prefix' },
		{ label: 'Analytics', disabled: true }
	];
</script>

{#snippet primaryAction()}
	<NavButton href="/campaign/new">New Campaign</NavButton>
{/snippet}

<div class="campaign-new-layout">
	<div class="hidden lg:block">
		<AdminSidebar
			title="Campaign Console"
			subtitle="Operational Navigation"
			{navItems}
			{primaryAction}
		/>
	</div>
	<div class="campaign-new-content">
		{@render children()}
	</div>
</div>

<style>
	.campaign-new-layout {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
		gap: 2rem;
		padding: 0 3rem 3rem;
	}

	.campaign-new-content {
		min-width: 0;
	}

	@media (max-width: 1200px) {
		.campaign-new-layout {
			grid-template-columns: 1fr;
			padding: 0.5rem;
		}
	}
</style>
