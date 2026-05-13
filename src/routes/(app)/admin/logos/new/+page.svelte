<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>New Logo</title>
</svelte:head>

<section class="bookings-content space-y-8 p-6 lg:p-10">
	<header class="mb-6">
		<h1 class="text-3xl font-semibold tracking-tight">Add logo</h1>
		<p class="mt-2 text-sm text-neutral-600">Create a trusted logo for landing page generation.</p>
	</header>

	<form
		method="POST"
		enctype="multipart/form-data"
		class="space-y-5 rounded-lg border border-neutral-200 bg-white p-6"
		use:enhance
	>
		<label class="flex flex-col gap-1 text-sm">
			<span>Client name</span>
			<input name="name" required class="rounded border border-neutral-300 px-3 py-2" />
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Logo alt text</span>
			<input name="logoAlt" required class="rounded border border-neutral-300 px-3 py-2" />
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Logo file (PNG, SVG, max 100kb)</span>
			<input
				name="logoFile"
				type="file"
				accept="image/png, image/svg+xml"
				required
				class="rounded border border-neutral-300 px-3 py-2"
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Priority</span>
			<input
				name="priority"
				type="number"
				min="1"
				max="999"
				value="100"
				required
				class="rounded border border-neutral-300 px-3 py-2"
			/>
		</label>

		{#if form?.formError}
			<p class="text-sm text-rose-700">{form.formError}</p>
		{/if}

		<div class="flex items-center gap-3">
			<Button>Create logo</Button>
			<NavButton variant="outline" href="/admin/logos">Cancel</NavButton>
		</div>
	</form>
</section>
