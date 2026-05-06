<script lang="ts">
	import { page } from '$app/state';
	import type { AppNavCategory } from '$lib/navigation/app-nav';

	export type AdminSidebarNavItem = {
		label: string;
		href?: string;
		icon?: string;
		disabled?: boolean;
		match?: 'exact' | 'prefix';
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
						? 'border-l-4 border-(--accent) bg-white pl-3 text-(--accent)'
						: 'hover:text-(--accent)'
				}`}
			>
				{#if item.icon}
					<span class={item.icon}></span>
				{/if}
				{item.label}
			</a>
		{/if}
	{/snippet}
	<nav class="flex flex-col gap-5">
		{#each categories as category (category.label)}
			<section class="flex flex-col gap-2">
				<p class="px-2 text-[0.62rem] tracking-[0.2em] text-[#777] uppercase">{category.label}</p>
				{#each category.items as item (item.label)}
					{@render navItem(item)}
				{/each}
			</section>
		{/each}
	</nav>

	<div class="mt-auto flex flex-col gap-2 uppercase">
		<a class=" no-underline" href="/admin/documentation">Documentation</a>
		<a href="/signout" class="text-left no-underline">Log Out</a>
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

	.mdi--chart-areaspline {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M17.45 15.18L22 7.31V21H2V3h2v12.54L9.5 6L16 9.78l4.24-7.33l1.73 1l-5.23 9.05l-6.51-3.75L4.31 19h2.26l4.39-7.56z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}

	.mdi--google-ads {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M12.25 1.47c-.7-.05-1.43.11-2.08.49a3.656 3.656 0 0 0-1.35 5l7.34 12.7c1.01 1.76 3.25 2.34 5.01 1.34c1.75-1 2.33-3.25 1.33-5L15.18 3.3a3.7 3.7 0 0 0-2.93-1.83M6.82 6.76L1.5 16a3.67 3.67 0 0 0-.5 1.83a3.67 3.67 0 0 0 3.67 3.67a3.67 3.67 0 0 0 3.17-1.84v.01L11 14.19c-1.35-2.3-2.73-4.59-3.97-6.96c-.08-.15-.15-.31-.2-.47ZL16.4 5Z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}

	.mdi--page-layout-header {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m0 2v4h12V4z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}

	.mdi--calendar-clock-outline {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M6 1v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h6.1c1.26 1.24 2.99 2 4.9 2c3.87 0 7-3.13 7-7c0-1.91-.76-3.64-2-4.9V5a2 2 0 0 0-2-2h-1V1h-2v2H8V1M5 5h14v2H5m0 2h14v.67c-.91-.43-1.93-.67-3-.67c-3.87 0-7 3.13-7 7c0 1.07.24 2.09.67 3H5m11-7.85c2.68 0 4.85 2.17 4.85 4.85s-2.17 4.85-4.85 4.85s-4.85-2.17-4.85-4.85s2.17-4.85 4.85-4.85M15 13v3.69l3.19 1.84l.75-1.3l-2.44-1.41V13Z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}

	.mdi--file-document {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M13 9h5.5L13 3.5zM6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4c0-1.11.89-2 2-2m9 16v-2H6v2zm3-4v-2H6v2z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}

	.material-symbols--arrow-back {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='m7.825 13l2.9 2.9L9.3 17.325L4 12.025l5.3-5.3l1.425 1.425l-2.9 2.9H20v1.95z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}

	.mdi--account-box-multiple {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M4 6H2v14a2 2 0 0 0 2 2h14v-2H4zm16-4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm-3 5a3 3 0 0 0-3-3a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3m-9 8v1h12v-1c0-2-4-3.1-6-3.1S8 13 8 15'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}

	.mdi--microphone-variant {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9 3a4 4 0 0 1 4 4H5a4 4 0 0 1 4-4m2.84 6.82L11 18h-1v1a2 2 0 0 0 2 2a2 2 0 0 0 2-2v-5a4 4 0 0 1 4-4h2l-1 1l1 1h-2a2 2 0 0 0-2 2v5a4 4 0 0 1-4 4a4 4 0 0 1-4-4v-1H7l-.84-8.18C5.67 9.32 5.31 8.7 5.13 8h7.74c-.18.7-.54 1.32-1.03 1.82M9 11a1 1 0 0 0-1 1a1 1 0 0 0 1 1a1 1 0 0 0 1-1a1 1 0 0 0-1-1'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
