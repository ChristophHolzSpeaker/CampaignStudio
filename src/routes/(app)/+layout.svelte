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
	const APP_SIDEBAR_WIDTH_KEY = 'app-sidebar-width';
	const APP_SIDEBAR_DEFAULT_WIDTH = 280;
	const APP_SIDEBAR_MIN_WIDTH = 40;
	let sidebarWidth = $state(APP_SIDEBAR_DEFAULT_WIDTH);
	let isResizing = $state(false);

	const clampSidebarWidth = (value: number) => {
		if (typeof window === 'undefined') {
			return value;
		}

		const maxWidth = Math.floor(window.innerWidth * 0.35);
		return Math.max(APP_SIDEBAR_MIN_WIDTH, Math.min(maxWidth, Math.round(value)));
	};

	const setSidebarWidthFromPointer = (clientX: number) => {
		if (typeof window === 'undefined') {
			return;
		}

		sidebarWidth = clampSidebarWidth(clientX);
	};

	const stopResize = () => {
		if (typeof window === 'undefined') {
			return;
		}

		isResizing = false;
		document.body.style.userSelect = '';
		window.localStorage.setItem(APP_SIDEBAR_WIDTH_KEY, String(sidebarWidth));
	};

	const onResizeHandlePointerDown = (event: PointerEvent) => {
		if (typeof window === 'undefined' || window.innerWidth <= 1200) {
			return;
		}

		event.preventDefault();
		isResizing = true;
		document.body.style.userSelect = 'none';
		setSidebarWidthFromPointer(event.clientX);
	};

	const onWindowPointerMove = (event: PointerEvent) => {
		if (!isResizing) {
			return;
		}

		setSidebarWidthFromPointer(event.clientX);
	};

	const onWindowPointerUp = () => {
		if (!isResizing) {
			return;
		}

		stopResize();
	};

	const onWindowResize = () => {
		sidebarWidth = clampSidebarWidth(sidebarWidth);
	};

	onMount(() => {
		const stored = Number(window.localStorage.getItem(APP_SIDEBAR_WIDTH_KEY));
		if (Number.isFinite(stored) && stored > 0) {
			sidebarWidth = clampSidebarWidth(stored);
		} else {
			sidebarWidth = clampSidebarWidth(APP_SIDEBAR_DEFAULT_WIDTH);
		}

		return () => {
			document.body.style.userSelect = '';
		};
	});
</script>

<svelte:window
	onpointermove={onWindowPointerMove}
	onpointerup={onWindowPointerUp}
	onpointercancel={onWindowPointerUp}
	onresize={onWindowResize}
/>

<svelte:head>
	<title>User Management</title>
</svelte:head>
<div class="page-shell">
	<div class="layout-grid" style={`--app-sidebar-width: ${sidebarWidth}px;`}>
		<aside class="sidebar-column hidden overflow-x-hidden transition-all lg:block">
			<AdminSidebar
				{categories}
				title="Christoph Campaign Studio"
				subtitle={currentUser?.displayName ?? 'Navigation'}
			/>
		</aside>
		<button
			type="button"
			class="resize-handle"
			class:is-resizing={isResizing}
			onpointerdown={onResizeHandlePointerDown}
			aria-label="Resize sidebar"
			title="Drag to resize"
		></button>
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
		grid-template-columns: var(--app-sidebar-width, 280px) 10px minmax(0, 1fr);
		min-height: 100vh;
		transition: grid-template-columns 200ms ease;
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

	.resize-handle {
		cursor: col-resize;
		border: 0;
		padding: 0;
		background: linear-gradient(
			to right,
			transparent 0,
			transparent 4px,
			#d9dbcf 4px,
			#d9dbcf 6px,
			transparent 6px,
			transparent 100%
		);
	}

	.resize-handle:hover,
	.resize-handle.is-resizing {
		background: linear-gradient(
			to right,
			transparent 0,
			transparent 3px,
			#94a3b8 3px,
			#94a3b8 7px,
			transparent 7px,
			transparent 100%
		);
	}

	@media (max-width: 1200px) {
		.layout-grid {
			grid-template-columns: 1fr;
		}

		.resize-handle {
			display: none;
		}
	}
</style>
