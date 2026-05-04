<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>New Client</title>
</svelte:head>

<section class="mx-auto max-w-3xl px-6 py-10">
	<header class="mb-6">
		<h1 class="text-3xl font-semibold tracking-tight">Add client</h1>
		<p class="mt-2 text-sm text-neutral-600">
			Create a client profile with logo and relevance metadata for campaign selection.
		</p>
	</header>

	<form
		method="POST"
		enctype="multipart/form-data"
		class="space-y-5 rounded-lg border border-neutral-200 bg-white p-6"
		use:enhance
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1 text-sm">
				<span>Client name</span>
				<input name="name" required class="rounded border border-neutral-300 px-3 py-2" />
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Industry</span>
				<input name="industry" required class="rounded border border-neutral-300 px-3 py-2" />
			</label>
		</div>

		<label class="flex flex-col gap-1 text-sm">
			<span>Logo alt text</span>
			<input name="logoAlt" required class="rounded border border-neutral-300 px-3 py-2" />
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Logo file (PNG, SVG, WEBP, max 1MB)</span>
			<input
				name="logoFile"
				type="file"
				accept="image/png ,image/webp, image/svg+xml"
				required
				class="rounded border border-neutral-300 px-3 py-2"
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Past keynote case study</span>
			<textarea
				name="keynoteCaseStudy"
				required
				rows="6"
				class="rounded border border-neutral-300 px-3 py-2"
			></textarea>
		</label>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1 text-sm">
				<span>Audiences (comma-separated)</span>
				<input name="audiences" class="rounded border border-neutral-300 px-3 py-2" />
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Topics (comma-separated)</span>
				<input name="topics" class="rounded border border-neutral-300 px-3 py-2" />
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Formats (comma-separated)</span>
				<input name="formats" class="rounded border border-neutral-300 px-3 py-2" />
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Geographies (comma-separated)</span>
				<input name="geographies" class="rounded border border-neutral-300 px-3 py-2" />
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Intent tags (comma-separated)</span>
				<input name="intentTags" class="rounded border border-neutral-300 px-3 py-2" />
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
		</div>

		{#if form?.formError}
			<p class="text-sm text-rose-700">{form.formError}</p>
		{/if}

		<div class="flex items-center gap-3">
			<Button>Create client</Button>
			<NavButton variant="outline" href="/admin/clients">Cancel</NavButton>
		</div>
	</form>
</section>
