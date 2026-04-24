<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
	import { createBrowserClient } from '@supabase/ssr';
	import type { Snippet } from 'svelte';

	const browserSupabase = browser
		? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
				global: {
					fetch
				}
			})
		: null;

	export type AdminSidebarNavItem = {
		label: string;
		href?: string;
		icon?: string;
		disabled?: boolean;
		match?: 'exact' | 'prefix';
	};

	type SidebarProps = {
		navItems?: readonly AdminSidebarNavItem[];
		primaryAction?: Snippet;
		title?: string;
		subtitle?: string;
	};

	const defaultNavItems: readonly AdminSidebarNavItem[] = [
		{
			label: 'Editor',
			icon: 'material-symbols--edit-note',
			match: 'prefix',
			href: '/(app)/admin/prompts'
		},
		{
			label: 'Library',
			icon: 'material-symbols--book',
			match: 'prefix',
			href: '/(app)/admin/library'
		}
	];

	let {
		navItems = defaultNavItems,
		primaryAction,
		title = 'Prompt Engine',
		subtitle = 'V2.4 Architectural'
	}: SidebarProps = $props();

	const currentPath = $derived($page.url.pathname);
	const toHref = (href: string) => href.replace(/\/\([^/]+\)/g, '');
	const toMatchPath = (href: string) => toHref(href).split('?')[0]?.split('#')[0] ?? '';

	const isActive = (item: AdminSidebarNavItem) => {
		if (!item.href || item.disabled) return false;
		const hrefPath = toMatchPath(item.href);
		if (item.match === 'exact') return currentPath === hrefPath;
		return currentPath.startsWith(hrefPath);
	};

	const handleSignOut = async () => {
		const loginPath = resolve('/(auth)/login');

		if (!browserSupabase) {
			await goto(loginPath, { replaceState: true });
			return;
		}

		const { error } = await browserSupabase.auth.signOut();
		if (error) {
			console.error('Failed to sign out', error);
		}

		await invalidate('supabase:auth');
		await goto(loginPath, { replaceState: true });
	};
</script>

<aside
	class="fixed top-[72px] bottom-0 left-0 z-20 flex w-[280px] flex-col gap-8 overflow-y-auto bg-[#f4f4f4] px-6 py-8"
>
	<div class="flex items-center gap-3">
		<div class="grid h-10 w-10 place-items-center bg-[#b8002a] text-white">
			<span class="material-symbols-outlined">precision_manufacturing</span>
		</div>
		<div>
			<p class="m-0 text-[0.8rem] tracking-[0.3em]">{title}</p>
			<p class="m-0 text-[0.65rem] tracking-[0.15em] text-[#4a4a4a]">{subtitle}</p>
		</div>
	</div>
	{#snippet navItem(item: AdminSidebarNavItem)}
		{#if item.disabled || !item.href}
			<div
				class="flex items-center gap-3 px-2 py-3 text-base text-[#9f9f9f] uppercase opacity-70"
				aria-disabled="true"
			>
				{#if item.icon}
					<span class={item.icon}></span>
				{/if}
				<span>{item.label}</span>
				<span class="ml-auto text-[0.58rem] tracking-[0.2em]">SOON</span>
			</div>
		{:else}
			<a
				href={toHref(item.href)}
				class={`flex items-center gap-3 px-2 py-3 text-base uppercase no-underline transition ${
					isActive(item)
						? 'border-l-4 border-[var(--accent)] bg-white pl-3 text-[var(--accent)]'
						: 'hover:text-[var(--accent)]'
				}`}
			>
				{#if item.icon}
					<span class={item.icon}></span>
				{/if}
				{item.label}
			</a>
		{/if}
	{/snippet}
	<nav class="flex flex-col gap-2">
		{#each navItems as item (item.label)}
			{@render navItem(item)}
		{/each}
	</nav>

	{#if primaryAction}
		{@render primaryAction()}
	{/if}

	<div class="mt-auto flex flex-col gap-2 uppercase">
		<a class="text-[#5d3f3f] no-underline" href={resolve('/(app)/admin/documentation')}
			>Documentation</a
		>
		<button type="button" class="text-left text-[#5d3f3f] no-underline" onclick={handleSignOut}>
			Log Out
		</button>
	</div>
</aside>

<style>
	.material-symbols--edit-note {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M4 14v-2h7v2zm0-4V8h11v2zm0-4V4h11v2zm9 14v-3.075l5.525-5.5q.225-.225.5-.325t.55-.1q.3 0 .575.113t.5.337l.925.925q.2.225.313.5t.112.55t-.1.563t-.325.512l-5.5 5.5zm6.575-5.6l.925-.975l-.925-.925l-.95.95z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
	.material-symbols--book {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M6 22q-.825 0-1.412-.587T4 20V4q0-.825.588-1.412T6 2h12q.825 0 1.413.588T20 4v16q0 .825-.587 1.413T18 22zm5-11l2.5-1.5L16 11V4h-5z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
