<script lang="ts">
	import { page } from '$app/state';
	import type { AppNavCategory } from '$lib/navigation/app-nav';

	export type AdminSidebarNavItem = {
		label: string;
		href?: string;
		disabled?: boolean;
		match?: 'exact' | 'prefix';
		level?: 0 | 1 | 2;
	};

	export type AdminSidebarNavCategory = AppNavCategory;

	type SidebarProps = {
		categories: readonly AdminSidebarNavCategory[];
		title?: string;
		subtitle?: string;
	};

	let {
		categories,
		title = 'Prompt Engine',
		subtitle = 'V2.4 Architectural'
	}: SidebarProps = $props();

	const currentPath = $derived(page.url.pathname);
	const toHref = (href: string) => href.replace(/\/\([^/]+\)/g, '');
	const toMatchPath = (href: string) => toHref(href).split('?')[0]?.split('#')[0] ?? '';

	const isActive = (item: AdminSidebarNavItem) => {
		if (!item.href || item.disabled) return false;
		const hrefPath = toMatchPath(item.href);
		if (item.match === 'exact') return currentPath === hrefPath;
		return currentPath.startsWith(hrefPath);
	};
</script>

<aside class="flex h-full min-h-screen flex-col gap-8 overflow-y-auto bg-[#f4f4f4] px-6 py-8">
	<div>
		<p class="text-[0.65rem] tracking-[0.18em] text-[#777] uppercase">{subtitle}</p>
		<h2 class="mt-2 text-xl">{title}</h2>
	</div>

	{#snippet navItem(item: AdminSidebarNavItem)}
		{#if item.disabled || !item.href}
			<div
				class={`px-2 py-3 font-sans text-xs text-[#9f9f9f] capitalize opacity-70 ${
					item.level === 1 ? 'pl-6' : item.level === 2 ? 'pl-10' : ''
				}`}
				aria-disabled="true"
			>
				<span>{item.label}</span>
				<span class="ml-auto text-[0.58rem] tracking-[0.2em]">SOON</span>
			</div>
		{:else}
			<a
				href={toHref(item.href)}
				class={`px block py-1 font-sans text-xs capitalize no-underline transition ${
					item.level === 1
						? 'ml-1 border-l border-l-stone-400 pl-2'
						: item.level === 2
							? 'ml-6 border-l border-l-stone-400 pl-2'
							: ''
				} ${isActive(item) ? 'text-(--accent)' : 'hover:text-(--accent)'}`}
			>
				{item.label}
			</a>
		{/if}
	{/snippet}
	<nav class="flex flex-col gap-5">
		{#each categories as category (category.id)}
			<section class="flex flex-col">
				{#each category.items as item (`${item.href ?? item.label}-${item.level ?? 0}`)}
					{@render navItem(item)}
				{/each}
			</section>
		{/each}
	</nav>

	<div class="mt-auto flex flex-col gap-2 font-sans capitalize">
		<a class="no-underline" href="/admin/documentation">Documentation</a>
		<a href="/signout" class="text-left no-underline">Log Out</a>
	</div>
</aside>
