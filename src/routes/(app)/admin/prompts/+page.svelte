<script>
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';
	import PromptCard from '$lib/components/PromptCard.svelte';

	const { data } = $props();
</script>

<svelte:head>
	<title>Prompt Library</title>
</svelte:head>

<section class="hero">
	<div class="hero-copy">
		<h1>Prompt library</h1>
		<p>
			Manage the system prompts that keep each audience and format aligned with the Campaign Studio
			voice. Each entry is a single source of truth for future campaigns.
		</p>
	</div>
	<div class="hero-actions">
		<NavButton href="/admin/prompts/new">New prompt</NavButton>
	</div>
</section>

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
		padding: 0 2rem 3rem;
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
