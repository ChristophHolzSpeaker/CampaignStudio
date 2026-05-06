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
</script>

<svelte:head>
	<title>User Management</title>
</svelte:head>
<div class="page-shell">
	<div class="layout-grid">
		<aside class="sidebar-column hidden lg:block">
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
	}

	.sidebar-column {
		position: sticky;
		top: 0;
		height: 100vh;
	}

	.layout-body {
		min-width: 0;
		padding: 0;
	}

	@media (max-width: 1200px) {
		.layout-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
