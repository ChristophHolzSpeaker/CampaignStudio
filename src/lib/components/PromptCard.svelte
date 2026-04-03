<script>
	import PromptBadgeList from './PromptBadgeList.svelte';

	const { prompt } = $props();

	const getBadgeConfig = () =>
		[
			{ label: prompt?.audience ?? '', tone: 'muted' },
			{ label: prompt?.format ?? '', tone: 'muted' },
			{
				label: prompt?.is_active ? 'Active' : 'Inactive',
				tone: prompt?.is_active ? 'accent' : 'muted'
			}
		].filter((badge) => badge.label);
</script>

<article class="prompt-card">
	<div class="card-head">
		<p class="purpose" aria-label="prompt purpose">{prompt?.purpose}</p>
		<PromptBadgeList badges={getBadgeConfig()} />
	</div>

	<h3>{prompt?.name}</h3>
	<p class="meta">Model · {prompt?.model}</p>

	<p class="snippet">{(prompt?.system_prompt ?? '').slice(0, 140)}...</p>
</article>

<style>
	.prompt-card {
		background: #ffffff;
		padding: 1.5rem;
		border-radius: 0;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		border: 0;
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.purpose {
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #b8002a;
		margin: 0;
	}

	h3 {
		margin: 0;
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		font-size: 1.25rem;
		text-transform: uppercase;
	}

	.meta {
		margin: 0;
		font-size: 0.9rem;
		color: #5d3f3f;
	}

	.snippet {
		margin: 0;
		color: #1a1c1c;
		font-family: 'Bureau Grot', sans-serif;
		line-height: 1.6;
	}
</style>
