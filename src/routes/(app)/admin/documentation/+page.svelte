<script lang="ts">
	import AdminSidebar, { type AdminSidebarNavItem } from '$lib/components/AdminSidebar.svelte';
	import MarkdownText from '$lib/components/elements/MarkdownText.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
		{
			label: 'Bookings',
			href: '/(app)/admin/bookings',
			match: 'prefix'
		},
		{
			label: 'Documentation',
			href: '/(app)/admin/documentation',
			match: 'prefix'
		}
	];
</script>

<svelte:head>
	<title>Campaign Documentation</title>
</svelte:head>

<div class="documentation-layout">
	<div class="hidden lg:block">
		<AdminSidebar {navItems} title="Campaign Docs" subtitle="Journey Reference" />
	</div>

	<section class="documentation-content space-y-8 p-6 lg:p-10">
		<div class="space-y-2">
			<p class="text-[0.7rem] tracking-[0.28em] text-[#777] uppercase">Admin › Documentation</p>
			<h1 class="text-[3rem] tracking-[-0.03em]">
				Campaign User Journey<span class="text-[var(--accent)]">.</span>
			</h1>
			<p class="max-w-[44rem] text-[0.95rem] text-[#5d3f3f]">
				Route-by-route operational reference for Campaign Studio. Use this as source material for
				journey diagrams and team onboarding.
			</p>
		</div>

		<article class="doc-shell">
			<MarkdownText content={data.markdown} />
		</article>
	</section>
</div>

<style>
	.documentation-layout {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
		gap: 2rem;
		padding: 0 3rem 3rem;
	}

	.documentation-content {
		min-width: 0;
	}

	.doc-shell {
		background: #ffffff;
		padding: 1.5rem;
	}

	@media (max-width: 1200px) {
		.documentation-layout {
			grid-template-columns: 1fr;
			padding: 0.5rem;
		}
	}
</style>
