<script lang="ts">
	import AdminSidebar, { type AdminSidebarNavItem } from '$lib/components/AdminSidebar.svelte';

	let { children } = $props();

	const navItems: readonly AdminSidebarNavItem[] = [
		{
			label: 'Campaigns',
			icon: 'material-symbols--edit-note',
			href: '/campaigns',
			match: 'prefix'
		},
		{
			label: 'Prompts',
			icon: 'material-symbols--book',
			href: '/prompts',
			match: 'prefix'
		},
		{
			label: 'Bookings',
			href: '/(app)/admin/bookings',
			match: 'prefix',
			icon: 'mdi--calendar-clock-outline'
		},
		{
			label: 'Clients',
			href: '/admin/clients',
			match: 'prefix',
			icon: 'mdi--account-box-multiple'
		},
		{
			label: 'Keynotes',
			href: '/admin/keynotes',
			match: 'prefix',
			icon: 'mdi--presentation-play'
		},
		{
			label: 'Documentation',
			href: '/(app)/admin/documentation',
			match: 'prefix',
			icon: 'mdi--file-document'
		}
	];
</script>

<div class="hidden lg:block">
	<AdminSidebar {navItems} title="Booking Engine" subtitle="MVP Configuration" />
</div>
{@render children?.()}
