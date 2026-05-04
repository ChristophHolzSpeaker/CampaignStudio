<script lang="ts">
	import NavButton from '$lib/components/elements/NavButton.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Clients Library</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-10">
	<header class="mb-6 flex items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Clients</h1>
			<p class="mt-2 text-sm text-neutral-600">
				Manage trusted client logos and relevance metadata used by landing page generation.
			</p>
		</div>
		<NavButton href="/admin/clients/new">Add client</NavButton>
	</header>

	<div class="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
		<table class="min-w-full border-collapse text-sm">
			<thead class="bg-neutral-50 text-left text-xs tracking-wider text-neutral-600 uppercase">
				<tr>
					<th class="px-4 py-3">Client</th>
					<th class="px-4 py-3">Industry</th>
					<th class="px-4 py-3">Priority</th>
					<th class="px-4 py-3">Status</th>
					<th class="px-4 py-3">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.clients as client (client.id)}
					<tr class="border-t border-neutral-100 align-top">
						<td class="px-4 py-3">
							<div class="flex items-center gap-3">
								<img
									src={client.logo_url}
									alt={client.logo_alt}
									class="h-8 w-auto max-w-28 object-contain"
								/>
								<div>
									<div class="font-medium text-neutral-900">{client.name}</div>
									<div class="text-xs text-neutral-500">{client.id}</div>
								</div>
							</div>
						</td>
						<td class="px-4 py-3 text-neutral-700">{client.industry}</td>
						<td class="px-4 py-3 text-neutral-700">{client.priority}</td>
						<td class="px-4 py-3">
							<span
								class={`rounded-full px-2 py-1 text-xs ${client.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'}`}
							>
								{client.is_active ? 'Active' : 'Inactive'}
							</span>
						</td>
						<td class="px-4 py-3">
							<div class="flex flex-wrap items-center gap-2">
								<a
									href={`/admin/clients/${client.id}`}
									class="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 no-underline"
								>
									Edit
								</a>
								<form method="POST" action="?/toggle">
									<input type="hidden" name="id" value={client.id} />
									<input type="hidden" name="active" value={client.is_active ? 'false' : 'true'} />
									<button
										type="submit"
										class="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
									>
										{client.is_active ? 'Deactivate' : 'Activate'}
									</button>
								</form>
								<form method="POST" action="?/delete">
									<input type="hidden" name="id" value={client.id} />
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
						<td class="px-4 py-8 text-sm text-neutral-500" colspan="5">
							No clients found. Add your first client to enable logos-of-trust selection.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
