<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { data, form } = $props();

	const keynoteStatuses = ['active', 'draft', 'review', 'archived'] as const;
	type KeynoteStatus = (typeof keynoteStatuses)[number];

	function statusLabel(status: KeynoteStatus): string {
		switch (status) {
			case 'active':
				return 'Active';
			case 'draft':
				return 'Draft';
			case 'review':
				return 'Review';
			case 'archived':
				return 'Archived';
		}
	}
</script>

<svelte:head>
	<title>Edit Keynote</title>
</svelte:head>

<section class="bookings-content space-y-8 p-6 lg:p-10">
	<header class="mb-6">
		<h1 class="text-3xl font-semibold tracking-tight">Edit keynote</h1>
		<p class="mt-2 text-sm text-neutral-600">Update keynote metadata, full copy, and image.</p>
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
			<span>Subtitle</span>
			<input
				name="subtitle"
				value={data.keynote.subtitle ?? ''}
				class="rounded border border-neutral-300 px-3 py-2"
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Status</span>
			<select name="status" class="rounded border border-neutral-300 px-3 py-2">
				{#each keynoteStatuses as status (status)}
					<option value={status} selected={data.keynote.status === status}>
						{statusLabel(status)}
					</option>
				{/each}
			</select>
		</label>

		<div class="grid gap-5 md:grid-cols-2">
			<label class="flex flex-col gap-1 text-sm">
				<span>Theme</span>
				<input
					name="theme"
					value={data.keynote.theme ?? ''}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>

			<label class="flex flex-col gap-1 text-sm">
				<span>Language</span>
				<input
					name="language"
					value={data.keynote.language ?? ''}
					class="rounded border border-neutral-300 px-3 py-2"
				/>
			</label>
		</div>

		<label class="flex flex-col gap-1 text-sm">
			<span>Audience</span>
			<textarea name="audience" rows="4" class="rounded border border-neutral-300 px-3 py-2"
				>{data.keynote.audience ?? ''}</textarea
			>
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
			<span>Moderation intro</span>
			<textarea name="moderation" rows="6" class="rounded border border-neutral-300 px-3 py-2"
				>{data.keynote.moderation ?? ''}</textarea
			>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Long copy (HTML)</span>
			<textarea name="keynoteLong" rows="14" class="rounded border border-neutral-300 px-3 py-2"
				>{data.keynote.keynote_long ?? ''}</textarea
			>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Keynote summary</span>
			<textarea name="keynoteShort" rows="6" class="rounded border border-neutral-300 px-3 py-2"
				>{data.keynote.keynote_short ?? ''}</textarea
			>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span>Speaker bio</span>
			<textarea name="speaker" rows="6" class="rounded border border-neutral-300 px-3 py-2"
				>{data.keynote.speaker ?? ''}</textarea
			>
		</label>

		{#if form?.formError}
			<p class="text-sm text-rose-700">{form.formError}</p>
		{/if}

		<div class="flex items-center gap-3">
			<Button>Save changes</Button>
			<NavButton href="/admin/keynotes" variant="outline">Cancel</NavButton>
		</div>
	</form>
</section>
