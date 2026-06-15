<script lang="ts">
	let { data } = $props();

	const keynoteStatuses = ['active', 'draft', 'review', 'archived', 'alt'] as const;
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
			case 'alt':
				return 'Alt';
		}
	}

	function statusClass(status: KeynoteStatus): string {
		switch (status) {
			case 'active':
				return 'bg-emerald-100 text-emerald-800';
			case 'draft':
				return 'bg-neutral-200 text-neutral-700';
			case 'review':
				return 'bg-amber-100 text-amber-800';
			case 'archived':
				return 'bg-rose-100 text-rose-800';
			case 'alt':
				return 'bg-neutral-200 text-neutral-700';
		}
	}
</script>

<svelte:head>
	<title>Keynotes Library</title>
</svelte:head>

<section class="bookings-content space-y-8 p-6 lg:p-10">
	<header class="mb-6 flex items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Keynotes</h1>
			<p class="mt-2 text-sm text-neutral-600">
				Manage keynote entries used by landing page generation.
			</p>
		</div>
	</header>

	<div class="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
		<table class="min-w-full border-collapse text-sm">
			<thead class="bg-neutral-50 text-left text-xs tracking-wider text-neutral-600 uppercase">
				<tr>
					<th class="px-4 py-3">Keynote</th>
					<th class="px-4 py-3">Status</th>
				</tr>
			</thead>
			<tbody>
				{#each data.keynotes as keynote (keynote.id)}
					<tr class="border-t border-neutral-100 align-top">
						<td class="px-4 py-3">
							<a
								href={`/admin/keynotes/${keynote.id}`}
								class="flex items-center gap-3 font-sans no-underline"
							>
								<img
									src={keynote.image_url}
									alt={keynote.image_alt}
									class="h-12 w-16 rounded object-cover"
								/>
								<div>
									<div class="font-medium text-neutral-900">{keynote.keynote_title}</div>
									<div class="text-xs text-neutral-500">{keynote.id}</div>
								</div>
							</a>
						</td>
						<td class="px-4 py-3">
							<span
								class={`rounded-full px-2 py-1 text-xs ${statusClass(keynote.status as KeynoteStatus)}`}
							>
								{statusLabel(keynote.status as KeynoteStatus)}
							</span>
						</td>
					</tr>
				{:else}
					<tr>
						<td class="px-4 py-8 text-sm text-neutral-500" colspan="3">
							No keynotes found. Add your first keynote to enable curated keynote selection.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
