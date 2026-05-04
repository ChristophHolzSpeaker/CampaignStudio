<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { data, form } = $props();

	const csv = (values: string[]) => values.join(', ');
</script>

<svelte:head>
	<title>Edit Keynote</title>
</svelte:head>

<section class="mx-auto max-w-3xl px-6 py-10">
	<header class="mb-6">
		<h1 class="text-3xl font-semibold tracking-tight">Edit keynote</h1>
		<p class="mt-2 text-sm text-neutral-600">
			Update keynote image and relevance metadata for campaign generation.
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
			<input
				name="keynoteTitle"
				required
				value={data.keynote.keynote_title}
				class="rounded border border-neutral-300 px-3 py-2"
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Image alt text</span>
			<input
				name="imageAlt"
				required
				value={data.keynote.image_alt}
				class="rounded border border-neutral-300 px-3 py-2"
			/>
		</label>

		<div class="flex items-center gap-4 rounded border border-neutral-200 p-3">
			<img
				src={data.keynote.image_url}
				alt={data.keynote.image_alt}
				class="h-16 w-24 rounded object-cover"
			/>
			<label class="flex flex-col gap-1 text-sm">
				<span>Replace image (optional)</span>
				<input
					name="imageFile"
					type="file"
					accept="image/png,image/jpeg,image/webp"
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
		</div>

		<label class="flex flex-col gap-1 text-sm">
			<span>Keynote summary</span>
			<textarea
				name="keynoteSummary"
				required
				rows="6"
				class="rounded border border-neutral-300 px-3 py-2">{data.keynote.keynote_summary}</textarea
			>
		</label>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1 text-sm">
				<span>Audiences (comma-separated)</span>
				<input
					name="audiences"
					value={csv(data.keynote.audiences)}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Topics (comma-separated)</span>
				<input
					name="topics"
					value={csv(data.keynote.topics)}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Formats (comma-separated)</span>
				<input
					name="formats"
					value={csv(data.keynote.formats)}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Geographies (comma-separated)</span>
				<input
					name="geographies"
					value={csv(data.keynote.geographies)}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Intent tags (comma-separated)</span>
				<input
					name="intentTags"
					value={csv(data.keynote.intent_tags)}
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
					value={data.keynote.priority}
					required
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
		</div>

		{#if form?.formError}
			<p class="text-sm text-rose-700">{form.formError}</p>
		{/if}

		<div class="flex items-center gap-3">
			<Button>Save changes</Button>
			<NavButton href="/admin/keynotes" variant="outline">Cancel</NavButton>
		</div>
	</form>
</section>
