<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>New Keynote</title>
</svelte:head>
<section class="bookings-content space-y-8 p-6 lg:p-10">
	<header class="mb-6">
		<h1 class="text-3xl font-semibold tracking-tight">Add keynote</h1>
		<p class="mt-2 text-sm text-neutral-600">
			Create a keynote profile with title, summary, and image.
		</p>
	</header>

	<form
		method="POST"
		enctype="multipart/form-data"
		class="space-y-5 rounded-lg border border-neutral-200 bg-white p-6"
		use:enhance
	>
		<label class="flex flex-col gap-1 text-sm">
			<span>Keynote title</span>
			<input name="keynoteTitle" required class="rounded border border-neutral-300 px-3 py-2" />
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Image alt text</span>
			<input name="imageAlt" required class="rounded border border-neutral-300 px-3 py-2" />
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Image file (PNG, JPG, WEBP, max 5MB)</span>
			<input
				name="imageFile"
				type="file"
				accept="image/png,image/jpeg,image/webp"
				required
				class="rounded border border-neutral-300 px-3 py-2"
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Keynote summary</span>
			<textarea
				name="keynoteSummary"
				required
				rows="6"
				class="rounded border border-neutral-300 px-3 py-2"
			></textarea>
		</label>

		{#if form?.formError}
			<p class="text-sm text-rose-700">{form.formError}</p>
		{/if}

		<div class="flex items-center gap-3">
			<Button>Create keynote</Button>
			<NavButton variant="outline" href="/admin/keynotes">Cancel</NavButton>
		</div>
	</form>
</section>
