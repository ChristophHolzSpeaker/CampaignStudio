<script lang="ts">
	import AdminSidebar, { type AdminSidebarNavItem } from '$lib/components/AdminSidebar.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { children } = $props();

	const navItems: readonly AdminSidebarNavItem[] = [
		{
			label: 'Editor',
			icon: 'material-symbols--edit-note',
			href: '/(app)/admin/prompts',
			match: 'prefix'
		},
		{
			label: 'Library',
			icon: 'material-symbols--book',
			href: '/(app)/admin/library',
			match: 'prefix'
		},
		{ label: 'Analytics', disabled: true }
	];
</script>

{#snippet primaryAction()}
	<NavButton href="/admin/prompts/new">New Prompt</NavButton>
{/snippet}

<div class="prompts-layout">
	<div class="hidden lg:block">
		<AdminSidebar {navItems} {primaryAction} />
	</div>
	<div class="prompts-content">
		{@render children()}
	</div>
</div>

<style>
	.prompts-layout {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
		gap: 2rem;
		padding: 0 3rem 3rem;
	}

	.prompts-content {
		min-width: 0;
	}

	@media (max-width: 1200px) {
		.prompts-layout {
			grid-template-columns: 1fr;
			padding: 0.5rem;
		}
	}
</style>
