<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { data, form } = $props();

	const csv = (values: string[]) => values.join(', ');
</script>

<svelte:head>
	<title>Edit Client</title>
</svelte:head>

<section class="bookings-content space-y-8 p-6 lg:p-10">
	<header class="mb-6">
		<h1 class="text-3xl font-semibold tracking-tight">Edit logo</h1>
		<p class="mt-2 text-sm text-neutral-600">
			Update logo and relevance metadata for campaign generation.
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
				<input
					name="name"
					required
					value={data.client.name}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Industry</span>
				<input
					name="industry"
					required
					value={data.client.industry}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
		</div>

		<label class="flex flex-col gap-1 text-sm">
			<span>Logo alt text</span>
			<input
				name="logoAlt"
				required
				value={data.client.logo_alt}
				class="rounded border border-neutral-300 px-3 py-2"
			/>
		</label>

		<div class="flex items-center gap-4 rounded border border-neutral-200 p-3">
			<img
				src={data.client.logo_url}
				alt={data.client.logo_alt}
				class="h-10 w-auto max-w-32 object-contain"
			/>
			<label class="flex flex-col gap-1 text-sm">
				<span>Replace logo (optional)</span>
				<input
					name="logoFile"
					type="file"
					accept="image/png,image/jpeg,image/webp"
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
		</div>

		<label class="flex flex-col gap-1 text-sm">
			<span>Past keynote case study</span>
			<textarea
				name="keynoteCaseStudy"
				required
				rows="6"
				class="rounded border border-neutral-300 px-3 py-2"
				>{data.client.keynote_case_study}</textarea
			>
		</label>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1 text-sm">
				<span>Audiences (comma-separated)</span>
				<input
					name="audiences"
					value={csv(data.client.audiences)}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Topics (comma-separated)</span>
				<input
					name="topics"
					value={csv(data.client.topics)}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Formats (comma-separated)</span>
				<input
					name="formats"
					value={csv(data.client.formats)}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Geographies (comma-separated)</span>
				<input
					name="geographies"
					value={csv(data.client.geographies)}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Intent tags (comma-separated)</span>
				<input
					name="intentTags"
					value={csv(data.client.intent_tags)}
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
					value={data.client.priority}
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
			<NavButton href="/admin/clients" variant="outline">Cancel</NavButton>
		</div>
	</form>
</section>
