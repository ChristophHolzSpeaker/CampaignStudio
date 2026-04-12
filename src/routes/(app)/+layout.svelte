<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import { invalidate } from '$app/navigation';
	import AdminShellHeader from '$lib/components/AdminShellHeader.svelte';
	import { onMount } from 'svelte';

	let { data, children } = $props();
	let { supabase, claims } = $derived(data);

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
	<AdminShellHeader />
	<div class="layout-body">
		{@render children()}
	</div>
</div>

<style>
	.page-shell {
		background: var(--surface);
		min-height: 100vh;
	}

	.layout-body {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 2rem;
		padding: 0 3rem 3rem;
	}

	@media (max-width: 1200px) {
		.layout-body {
			grid-template-columns: 1fr;
			padding: 0.5rem 0.5rem;
		}
	}
</style>
