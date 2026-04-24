<script lang="ts">
	import AdminSidebar, { type AdminSidebarNavItem } from '$lib/components/AdminSidebar.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	function formatTimestamp(value: Date | null): string {
		if (!value) {
			return 'Not set';
		}

		return value.toLocaleString('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	function ruleNumberValue(
		bookingType: 'lead' | 'general',
		field: 'advanceNoticeMinutes' | 'slotDurationMinutes' | 'slotIntervalMinutes'
	): string {
		const activeForm = form?.rulesForm;
		if (activeForm && activeForm.values.bookingType === bookingType) {
			return activeForm.values[field];
		}

		const rule = data.rules[bookingType];
		if (!rule) {
			return '';
		}

		return String(rule[field]);
	}

	function ruleEnabledValue(bookingType: 'lead' | 'general'): boolean {
		const activeForm = form?.rulesForm;
		if (activeForm && activeForm.values.bookingType === bookingType) {
			return activeForm.values.isEnabled;
		}

		return data.rules[bookingType]?.isEnabled ?? false;
	}

	function ruleError(
		bookingType: 'lead' | 'general',
		field: 'advanceNoticeMinutes' | 'slotDurationMinutes' | 'slotIntervalMinutes'
	): string | undefined {
		const activeForm = form?.rulesForm;
		if (!activeForm || activeForm.values.bookingType !== bookingType) {
			return undefined;
		}

		return activeForm.errors?.[field];
	}

	const pauseMessageValue = $derived(
		form?.pauseForm?.values.pauseMessage ?? data.pause.pauseMessage ?? ''
	);
	const pauseCheckedValue = $derived(form?.pauseForm?.values.isPaused ?? data.pause.isPaused);

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
	<title>Booking settings</title>
</svelte:head>

<div class="bookings-layout">
	<div class="hidden lg:block">
		<AdminSidebar {navItems} title="Booking Engine" subtitle="MVP Configuration" />
	</div>
	<section class="bookings-content space-y-8 p-6 lg:p-10">
		<div class="space-y-2">
			<p class="text-[0.7rem] tracking-[0.28em] text-[#777] uppercase">Admin › Booking module</p>
			<h1 class="text-[3rem] tracking-[-0.03em]">
				Booking settings<span class="text-[var(--accent)]">.</span>
			</h1>
			<p class="max-w-[40rem] text-[0.95rem] text-[#5d3f3f]">
				Configure lead and general booking rules plus the global pause control used by public
				booking routes.
			</p>
		</div>

		<section class="grid gap-6 lg:grid-cols-2">
			<article class="space-y-4 bg-white p-6">
				<div class="space-y-1">
					<h2 class="text-2xl">Lead booking rules</h2>
					<p class="text-sm text-[#5d3f3f]">
						Current status: {data.rules.lead?.isEnabled ? 'Enabled' : 'Disabled'}
					</p>
					<p class="text-xs tracking-[0.16em] text-[#777] uppercase">
						Last updated: {formatTimestamp(data.rules.lead?.updatedAt ?? null)}
					</p>
				</div>

				<form method="POST" action="?/updateRules" class="space-y-4">
					<input type="hidden" name="booking_type" value="lead" />
					<label class="block text-sm">
						<span>Advance notice (minutes)</span>
						<input
							type="number"
							name="advance_notice_minutes"
							min="0"
							value={ruleNumberValue('lead', 'advanceNoticeMinutes')}
							class="mt-1 w-full bg-[#f3f3f3] px-3 py-2"
						/>
						{#if ruleError('lead', 'advanceNoticeMinutes')}
							<p class="mt-1 text-sm text-[#b8002a]">{ruleError('lead', 'advanceNoticeMinutes')}</p>
						{/if}
					</label>

					<label class="block text-sm">
						<span>Slot duration (minutes)</span>
						<input
							type="number"
							name="slot_duration_minutes"
							min="1"
							value={ruleNumberValue('lead', 'slotDurationMinutes')}
							class="mt-1 w-full bg-[#f3f3f3] px-3 py-2"
						/>
						{#if ruleError('lead', 'slotDurationMinutes')}
							<p class="mt-1 text-sm text-[#b8002a]">{ruleError('lead', 'slotDurationMinutes')}</p>
						{/if}
					</label>

					<label class="block text-sm">
						<span>Slot interval (minutes)</span>
						<input
							type="number"
							name="slot_interval_minutes"
							min="1"
							value={ruleNumberValue('lead', 'slotIntervalMinutes')}
							class="mt-1 w-full bg-[#f3f3f3] px-3 py-2"
						/>
						{#if ruleError('lead', 'slotIntervalMinutes')}
							<p class="mt-1 text-sm text-[#b8002a]">{ruleError('lead', 'slotIntervalMinutes')}</p>
						{/if}
					</label>

					<label class="inline-flex items-center gap-2 text-sm">
						<input type="checkbox" name="is_enabled" checked={ruleEnabledValue('lead')} />
						<span>Enable lead bookings</span>
					</label>

					<button
						type="submit"
						class="inline-flex bg-[var(--accent)] px-4 py-2 text-sm tracking-[0.12em] text-white uppercase"
					>
						Save lead rules
					</button>

					{#if form?.rulesForm?.values.bookingType === 'lead' && form.rulesForm.message}
						<p class={form.rulesForm.success ? 'text-sm text-[#007a3d]' : 'text-sm text-[#b8002a]'}>
							{form.rulesForm.message}
						</p>
					{/if}
				</form>
			</article>

			<article class="space-y-4 bg-white p-6">
				<div class="space-y-1">
					<h2 class="text-2xl">General booking rules</h2>
					<p class="text-sm text-[#5d3f3f]">
						Current status: {data.rules.general?.isEnabled ? 'Enabled' : 'Disabled'}
					</p>
					<p class="text-xs tracking-[0.16em] text-[#777] uppercase">
						Last updated: {formatTimestamp(data.rules.general?.updatedAt ?? null)}
					</p>
				</div>

				<form method="POST" action="?/updateRules" class="space-y-4">
					<input type="hidden" name="booking_type" value="general" />
					<label class="block text-sm">
						<span>Advance notice (minutes)</span>
						<input
							type="number"
							name="advance_notice_minutes"
							min="0"
							value={ruleNumberValue('general', 'advanceNoticeMinutes')}
							class="mt-1 w-full bg-[#f3f3f3] px-3 py-2"
						/>
						{#if ruleError('general', 'advanceNoticeMinutes')}
							<p class="mt-1 text-sm text-[#b8002a]">
								{ruleError('general', 'advanceNoticeMinutes')}
							</p>
						{/if}
					</label>

					<label class="block text-sm">
						<span>Slot duration (minutes)</span>
						<input
							type="number"
							name="slot_duration_minutes"
							min="1"
							value={ruleNumberValue('general', 'slotDurationMinutes')}
							class="mt-1 w-full bg-[#f3f3f3] px-3 py-2"
						/>
						{#if ruleError('general', 'slotDurationMinutes')}
							<p class="mt-1 text-sm text-[#b8002a]">
								{ruleError('general', 'slotDurationMinutes')}
							</p>
						{/if}
					</label>

					<label class="block text-sm">
						<span>Slot interval (minutes)</span>
						<input
							type="number"
							name="slot_interval_minutes"
							min="1"
							value={ruleNumberValue('general', 'slotIntervalMinutes')}
							class="mt-1 w-full bg-[#f3f3f3] px-3 py-2"
						/>
						{#if ruleError('general', 'slotIntervalMinutes')}
							<p class="mt-1 text-sm text-[#b8002a]">
								{ruleError('general', 'slotIntervalMinutes')}
							</p>
						{/if}
					</label>

					<label class="inline-flex items-center gap-2 text-sm">
						<input type="checkbox" name="is_enabled" checked={ruleEnabledValue('general')} />
						<span>Enable general bookings</span>
					</label>

					<button
						type="submit"
						class="inline-flex bg-[var(--accent)] px-4 py-2 text-sm tracking-[0.12em] text-white uppercase"
					>
						Save general rules
					</button>

					{#if form?.rulesForm?.values.bookingType === 'general' && form.rulesForm.message}
						<p class={form.rulesForm.success ? 'text-sm text-[#007a3d]' : 'text-sm text-[#b8002a]'}>
							{form.rulesForm.message}
						</p>
					{/if}
				</form>
			</article>
		</section>

		<article class="space-y-4 bg-white p-6">
			<div class="space-y-1">
				<h2 class="text-2xl">Global booking pause</h2>
				<p class="text-sm text-[#5d3f3f]">
					Current state: {data.pause.isPaused ? 'Paused' : 'Active'}
				</p>
				<p class="text-xs tracking-[0.16em] text-[#777] uppercase">
					Last updated: {formatTimestamp(data.pause.updatedAt)}
				</p>
			</div>

			<form method="POST" action="?/updatePause" class="space-y-4">
				<label class="inline-flex items-center gap-2 text-sm">
					<input type="checkbox" name="is_paused" checked={pauseCheckedValue} />
					<span>Pause all bookings</span>
				</label>

				<label class="block text-sm">
					<span>Pause message (optional)</span>
					<textarea name="pause_message" rows="3" class="mt-1 w-full bg-[#f3f3f3] px-3 py-2"
						>{pauseMessageValue}</textarea
					>
					{#if form?.pauseForm?.errors?.pauseMessage}
						<p class="mt-1 text-sm text-[#b8002a]">{form.pauseForm.errors.pauseMessage}</p>
					{/if}
				</label>

				<button
					type="submit"
					class="inline-flex bg-[var(--accent)] px-4 py-2 text-sm tracking-[0.12em] text-white uppercase"
				>
					Save pause settings
				</button>

				{#if form?.pauseForm?.message}
					<p class={form.pauseForm.success ? 'text-sm text-[#007a3d]' : 'text-sm text-[#b8002a]'}>
						{form.pauseForm.message}
					</p>
				{/if}
			</form>
		</article>
	</section>
</div>

<style>
	.bookings-layout {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
		gap: 2rem;
		padding: 0 3rem 3rem;
	}

	.bookings-content {
		min-width: 0;
	}

	@media (max-width: 1200px) {
		.bookings-layout {
			grid-template-columns: 1fr;
			padding: 0.5rem;
		}
	}
</style>
