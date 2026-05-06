<script lang="ts">
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Keynotes Library</title>
</svelte:head>

<section class="bookings-content space-y-8 p-6 lg:p-10">
	<header class="mb-6 flex items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Keynotes</h1>
			<p class="mt-2 text-sm text-neutral-600">
				Manage keynote entries and relevance metadata used by landing page generation.
			</p>
		</div>
		<NavButton href="/admin/keynotes/new">Add keynote</NavButton>
	</header>

	<div class="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
		<table class="min-w-full border-collapse text-sm">
			<thead class="bg-neutral-50 text-left text-xs tracking-wider text-neutral-600 uppercase">
				<tr>
					<th class="px-4 py-3">Keynote</th>
					<th class="px-4 py-3">Priority</th>
					<th class="px-4 py-3">Status</th>
					<th class="px-4 py-3">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.keynotes as keynote (keynote.id)}
					<tr class="border-t border-neutral-100 align-top">
						<td class="px-4 py-3">
							<div class="flex items-center gap-3">
								<img
									src={keynote.image_url}
									alt={keynote.image_alt}
									class="h-12 w-16 rounded object-cover"
								/>
								<div>
									<div class="font-medium text-neutral-900">{keynote.keynote_title}</div>
									<div class="text-xs text-neutral-500">{keynote.id}</div>
								</div>
							</div>
						</td>
						<td class="px-4 py-3 text-neutral-700">{keynote.priority}</td>
						<td class="px-4 py-3">
							<span
								class={`rounded-full px-2 py-1 text-xs ${keynote.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'}`}
							>
								{keynote.is_active ? 'Active' : 'Inactive'}
							</span>
						</td>
						<td class="px-4 py-3">
							<div class="flex flex-wrap items-center gap-2">
								<a
									href={`/admin/keynotes/${keynote.id}`}
									class="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 no-underline"
								>
									Edit
								</a>
								<form method="POST" action="?/toggle">
									<input type="hidden" name="id" value={keynote.id} />
									<input type="hidden" name="active" value={keynote.is_active ? 'false' : 'true'} />
									<button
										type="submit"
										class="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
									>
										{keynote.is_active ? 'Deactivate' : 'Activate'}
									</button>
								</form>
								<form method="POST" action="?/delete">
									<input type="hidden" name="id" value={keynote.id} />
									<button
										type="submit"
										class="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700"
									>
										Delete
									</button>
								</form>
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td class="px-4 py-8 text-sm text-neutral-500" colspan="4">
							No keynotes found. Add your first keynote to enable curated keynote selection.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
