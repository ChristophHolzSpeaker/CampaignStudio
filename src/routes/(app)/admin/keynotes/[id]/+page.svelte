<script lang="ts">
	let { data } = $props();

	const keynoteStatuses = ['active', 'draft', 'review', 'archived', 'alt'] as const;
	type KeynoteStatus = (typeof keynoteStatuses)[number];
	type KeynoteTextField = string | null | undefined;

	function displayValue(value: KeynoteTextField): string {
		return value && value.length > 0 ? value : '—';
	}

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
			case 'alt':
				return 'Alt';
			default:
				return status;
		}
	}
</script>

<svelte:head>
	<title>Keynote details</title>
</svelte:head>

<section class="bookings-content space-y-8 p-6 lg:p-10">
	<nav aria-label="Breadcrumb" class="text-sm text-neutral-500">
		<a href="/admin/keynotes" class="font-medium text-neutral-700 hover:text-neutral-900">
			All keynotes
		</a>
	</nav>

	<header class="space-y-2">
		<h1 class="text-3xl font-semibold tracking-tight">{data.keynote.keynote_title}</h1>
		<p class="text-sm text-neutral-600">{displayValue(data.keynote.subtitle)}</p>
	</header>

	<figure class="overflow-hidden rounded-lg border border-neutral-200 bg-white">
		<img
			src={data.keynote.image_url}
			alt={data.keynote.image_alt}
			class="h-auto w-full object-cover"
		/>
	</figure>

	<div class="grid gap-5 xl:grid-cols-2">
		<section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
				Keynote details
			</h2>

			<dl class="mt-4 grid gap-4 sm:grid-cols-2">
				<div>
					<dt class="text-xs font-medium tracking-wide text-neutral-500 uppercase">Status</dt>
					<dd class="mt-1 text-sm text-neutral-900">{statusLabel(data.keynote.status)}</dd>
				</div>

				<div>
					<dt class="text-xs font-medium tracking-wide text-neutral-500 uppercase">Theme</dt>
					<dd class="mt-1 text-sm text-neutral-900">{displayValue(data.keynote.theme)}</dd>
				</div>

				<div>
					<dt class="text-xs font-medium tracking-wide text-neutral-500 uppercase">Language</dt>
					<dd class="mt-1 text-sm text-neutral-900">{displayValue(data.keynote.language)}</dd>
				</div>

				<div>
					<dt class="text-xs font-medium tracking-wide text-neutral-500 uppercase">
						Image alt text
					</dt>
					<dd class="mt-1 text-sm text-neutral-900">{displayValue(data.keynote.image_alt)}</dd>
				</div>
			</dl>
		</section>

		<section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-neutral-700 uppercase">Audience</h2>
			<p class="mt-4 text-sm leading-6 whitespace-pre-wrap text-neutral-700">
				{displayValue(data.keynote.audience)}
			</p>
		</section>

		<section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm xl:col-span-2">
			<h2 class="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
				Moderation intro
			</h2>
			<p class="mt-4 text-sm leading-6 whitespace-pre-wrap text-neutral-700">
				{displayValue(data.keynote.moderation)}
			</p>
		</section>

		<section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm xl:col-span-2">
			<h2 class="text-sm font-semibold tracking-wide text-neutral-700 uppercase">Long copy</h2>
			<p class="mt-4 text-sm leading-6 break-words whitespace-pre-wrap text-neutral-700">
				{displayValue(data.keynote.keynote_long)}
			</p>
		</section>

		<section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm xl:col-span-2">
			<h2 class="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
				Keynote summary
			</h2>
			<p class="mt-4 text-sm leading-6 whitespace-pre-wrap text-neutral-700">
				{displayValue(data.keynote.keynote_short)}
			</p>
		</section>

		<section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm xl:col-span-2">
			<h2 class="text-sm font-semibold tracking-wide text-neutral-700 uppercase">Speaker bio</h2>
			<p class="mt-4 text-sm leading-6 whitespace-pre-wrap text-neutral-700">
				{displayValue(data.keynote.speaker)}
			</p>
		</section>
	</div>
</section>
