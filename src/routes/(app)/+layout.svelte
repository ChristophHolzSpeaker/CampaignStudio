<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import AdminSidebar from '$lib/components/AdminSidebar.svelte';
	import { getAppNavCategories } from '$lib/navigation/app-nav';
	import { onMount } from 'svelte';

	let { data, children } = $props();
	let { supabase, claims, currentUser } = $derived(data);
	const categories = $derived(getAppNavCategories(page.url.pathname, page.data));

	onMount(() => {
		const { data } = supabase.auth.onAuthStateChange((event, _session) => {
			if (_session?.expires_at !== claims?.exp) {
				invalidate('supabase:auth');
			}
		});

		return () => data.subscription.unsubscribe();
	});
	let collapsed = $state(false);
	function handleCollapse() {
		collapsed = !collapsed;
	}
</script>

<svelte:head>
	<title>User Management</title>
</svelte:head>
<div class="page-shell">
	<div class="layout-grid" class:collapsed>
		<aside class="sidebar-column hidden overflow-x-hidden transition-all lg:block">
			<button
				title="collapse"
				type="button"
				onclick={handleCollapse}
				class="mt-2 ml-2 h-6 w-6"
				class:mdi--arrow-collapse-right={collapsed}
				class:mdi--arrow-collapse-left={!collapsed}
			></button>
			<AdminSidebar
				{categories}
				title="Christoph Campaign Studio"
				subtitle={currentUser?.displayName ?? 'Navigation'}
			/>
		</aside>
		<div class="layout-body">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.page-shell {
		background: var(--surface);
		min-height: 100vh;
	}

	.layout-grid {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
		min-height: 100vh;
		transition: grid-template-columns 200ms ease;
	}

	.layout-grid.collapsed {
		grid-template-columns: 40px minmax(0, 1fr);
	}

	.sidebar-column {
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-x: hidden;
	}

	.layout-body {
		min-width: 0;
		padding: 0;
	}

	@media (max-width: 1200px) {
		.layout-grid,
		.layout-grid.collapsed {
			grid-template-columns: 1fr;
		}
	}

	.mdi--arrow-collapse-left {
		display: inline-block;

		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M11.92 19.92L4 12l7.92-7.92l1.41 1.42l-5.5 5.5H22v2H7.83l5.51 5.5zM4 12V2H2v20h2z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}

	.mdi--arrow-collapse-right {
		display: inline-block;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12.08 4.08L20 12l-7.92 7.92l-1.41-1.42l5.5-5.5H2v-2h14.17l-5.5-5.5zM20 12v10h2V2h-2z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
