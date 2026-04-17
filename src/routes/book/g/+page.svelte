<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/elements/Button.svelte';
	import Input from '$lib/components/elements/Input.svelte';
	import TextArea from '$lib/components/elements/TextArea.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	const isUnavailable = $derived(data.policyState !== 'active');

	function formatDayLabel(dateKey: string): string {
		const date = new Date(`${dateKey}T00:00:00.000Z`);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatSlotRange(startsAtIso: string, endsAtIso: string): string {
		const startsAt = new Date(startsAtIso);
		const endsAt = new Date(endsAtIso);
		const dateLabel = startsAt.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
		const startTime = startsAt.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
		const endTime = endsAt.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});

		return `${dateLabel} ${startTime} - ${endTime}`;
	}
</script>

<svelte:head>
	<title>Book a general briefing</title>
</svelte:head>

<div class="min-h-screen bg-sky-50 py-12">
	<div class="mx-auto w-full max-w-4xl px-4">
		<div class="space-y-8 bg-white p-8 shadow-lg">
			<p class="text-[0.6rem] tracking-[0.5em] text-slate-500 uppercase">Campaign studio</p>
			<h1 class="text-4xl font-semibold text-slate-900">General booking request</h1>
			<p class="text-sm leading-relaxed text-slate-600">
				Share your email and meeting purpose, then choose from available slots in the next 3 days.
			</p>

			{#if isUnavailable}
				<div
					class="rounded-2xl border border-amber-400/70 bg-amber-50 px-4 py-4 text-sm text-amber-800"
				>
					{data.unavailableMessage ?? 'Booking is currently unavailable.'}
				</div>
			{:else}
				<form method="POST" class="space-y-6" use:enhance>
					{#if form?.message}
						<div
							class={`rounded-2xl border px-4 py-3 text-xs font-semibold tracking-[0.3em] uppercase ${
								form.availabilityState === 'available'
									? 'border-emerald-400/70 bg-emerald-50 text-emerald-700'
									: 'border-amber-400/70 bg-amber-50 text-amber-700'
							}`}
						>
							{form.message}
						</div>
					{/if}

					<Input
						id="email"
						name="email"
						label="Email"
						type="email"
						placeholder="you@example.com"
						value={form?.values?.email ?? ''}
						error={form?.errors?.email}
						autocomplete="email"
					/>

					<Input
						id="name"
						name="name"
						label="Name (optional)"
						type="text"
						placeholder="Your name"
						value={form?.values?.name ?? ''}
						error={form?.errors?.name}
						autocomplete="name"
					/>

					<Input
						id="company"
						name="company"
						label="Company (optional)"
						type="text"
						placeholder="Your company"
						value={form?.values?.company ?? ''}
						error={form?.errors?.company}
						autocomplete="organization"
					/>

					<TextArea
						id="scope"
						name="scope"
						label="Meeting purpose"
						placeholder="Describe what you want to cover"
						value={form?.values?.scope ?? ''}
						error={form?.errors?.scope}
						rows={4}
					/>

					<Button>Check available slots</Button>
				</form>

				{#if form?.classification}
					<div
						class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
					>
						<p>
							Requester type:
							<strong
								>{form.classification.interactionKind === 'repeat'
									? 'Repeat'
									: 'First-time'}</strong
							>
						</p>
						<p>
							Upcoming booking:
							<strong>{form.classification.hasUpcomingBooking ? 'Yes' : 'No'}</strong>
						</p>
					</div>
				{/if}

				{#if form?.availabilityState === 'available' && form.slotGroups && form.slotGroups.length > 0}
					<div class="space-y-4">
						<h2 class="text-2xl text-slate-900">Available slots</h2>
						{#each form.slotGroups as day (day.dateKey)}
							<section class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
								<h3 class="text-lg text-slate-900">{formatDayLabel(day.dateKey)}</h3>
								<ul class="space-y-2">
									{#each day.slots as slot (slot.startsAtIso)}
										<li class="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
											{formatSlotRange(slot.startsAtIso, slot.endsAtIso)}
										</li>
									{/each}
								</ul>
							</section>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
