<script>
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';
	import PromptCard from '$lib/components/PromptCard.svelte';

	const { data } = $props();
</script>

<svelte:head>
	<title>Prompt Library</title>
</svelte:head>
<section class="flex flex-col gap-6 p-6 lg:p-10">
	<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
		<div class="space-y-2">
			<div class="flex items-center gap-1 text-[0.7rem] tracking-[0.3em] text-[#777] uppercase">
				<span>Prompt Library</span>
				<span class="text-[1rem] text-[var(--accent)]">›</span>
				<span>Editor</span>
			</div>
			<h1 class="mt-1 text-[3.5rem] tracking-[-0.03em]">
				Prompt library<span class="text-[var(--accent)]">.</span>
			</h1>
			<p class="max-w-[32rem] text-[0.95rem] text-[#5d3f3f]">
				Manage the system prompts that keep each audience and format aligned with the Campaign
				Studio voice. Each entry is a single source of truth for future campaigns.
			</p>
		</div>
		<div class="self-start">
			<div class="flex items-center gap-4">
				<NavButton href="/admin/prompts/new">New prompt</NavButton>
			</div>
		</div>
	</div>
	<section class="prompt-grid">
		{#each data.prompts as prompt}
			<form method="POST" action="?/toggle" class="prompt-shell">
				<input type="hidden" name="id" value={prompt.id} />
				<input type="hidden" name="active" value={prompt.is_active ? 'true' : 'false'} />
				<PromptCard {prompt} />
				<div class="card-actions px-6">
					<button type="submit" class="toggle-button">
						{prompt.is_active ? 'Deactivate' : 'Activate'}
					</button>
					<a class="outline-link" href={`/admin/prompts/${prompt.id}`}>Edit</a>
				</div>
			</form>
		{/each}
	</section>
</section>

<style>
	.hero {
		display: flex;
		justify-content: space-between;
		align-items: center;

		padding: 3rem 2rem;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.hero-copy {
		max-width: 720px;
	}

	h1 {
		margin: 0.4rem 0;
		font-size: 2.75rem;
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		text-transform: uppercase;
	}

	.hero p {
		margin: 0;
		font-family: 'Bureau Grot', 'Space Grotesk', sans-serif;
		line-height: 1.8;
	}

	.hero-actions {
		display: flex;
		align-items: center;
	}

	.prompt-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1rem;
		padding: 0 0 3rem;
	}

	.prompt-shell {
		background: #ffffff;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.toggle-button {
		background: transparent;
		color: #b8002a;
		border: 0;
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.card-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.prompt-shell .outline-link {
		color: inherit;
		text-decoration: underline;
	}
</style>
