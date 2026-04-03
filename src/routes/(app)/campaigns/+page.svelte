<script lang="ts">
	let { data } = $props();

	let isLoading = $state<boolean>(true);
	let error = $state<string | null>(null);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Campaigns</h1>
		<button
			onclick={() => {
				// TODO: Navigate to campaign creation form
				alert('Campaign creation form coming soon');
			}}
			class="btn btn-primary"
		>
			New Campaign
		</button>
	</div>

	{#if isLoading}
		<div class="vertical-xl text-center">
			<div class="loading loading-spinner loading-lg mx-auto"></div>
			<p>Loading campaigns...</p>
		</div>
	{:else if error}
		<div class="alert alert-error">
			{error}
			<button class="btn btn-xs"> Retry </button>
		</div>
	{:else if data.campaignList.length === 0}
		<div class="vertical-xl text-center">
			<p class="text-muted-foreground">
				No campaigns found. Create your first campaign to get started.
			</p>
			<button
				onclick={() => {
					// TODO: Navigate to campaign creation form
					alert('Campaign creation form coming soon');
				}}
				class="btn btn-primary"
			>
				Create First Campaign
			</button>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="table w-full">
				<thead>
					<tr>
						<th>Campaign Name</th>
						<th>Audience</th>
						<th>Format</th>
						<th>Topic</th>
						<th>Status</th>
						<th>Created</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.campaignList as campaign (campaign.id)}
						<tr>
							<td>{campaign.name}</td>
							<td>{campaign.audience}</td>
							<td>{campaign.format}</td>
							<td>{campaign.topic}</td>
							<td>
								<span
									class={`badge 
										${
											campaign.status === 'published'
												? 'badge-success'
												: campaign.status === 'generated'
													? 'badge-info'
													: campaign.status === 'draft'
														? 'badge-warning'
														: 'badge-secondary'
										}`}
								>
									{campaign.status}
								</span>
							</td>
							<td>{new Date(campaign.created_at).toLocaleDateString()}</td>
							<td class="flex space-x-2">
								<button
									onclick={() => {
										// TODO: Navigate to campaign detail view
										alert(`View campaign: ${campaign.name}`);
									}}
									class="btn btn-sm btn-outline"
								>
									View
								</button>
								<button
									onclick={() => {
										// TODO: Navigate to campaign edit form
										alert(`Edit campaign: ${campaign.name}`);
									}}
									class="btn btn-sm btn-outline"
								>
									Edit
								</button>
								<button
									onclick={() => {
										if (confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) {
											// TODO: Implement campaign deletion
											alert(`Delete campaign: ${campaign.name}`);
										}
									}}
									class="btn btn-sm btn-outline btn-error"
								>
									Delete
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	/* Custom styles for the campaigns page */
	.badge-success {
		--btn-bg: hsl(142 76% 36%);
		--btn-hover-bg: hsl(142 76% 30%);
		--btn-color: hsl(0 0% 100%);
	}

	.badge-info {
		--btn-bg: hsl(217 91% 60%);
		--btn-hover-bg: hsl(217 91% 50%);
		--btn-color: hsl(0 0% 100%);
	}

	.badge-warning {
		--btn-bg: hsl(47 100% 67%);
		--btn-hover-bg: hsl(47 100% 57%);
		--btn-color: hsl(0 0% 0%);
	}
</style>
