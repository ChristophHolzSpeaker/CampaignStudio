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
	<p class="meta flex items-center">
		<span class="mdi--person-arrow-left-outline"></span> · {prompt?.model}
	</p>

	<p class="snippet rounded bg-stone-100 p-4 italic">
		{(prompt?.system_prompt ?? '').slice(0, 140)}...
	</p>
</article>

<style>
	.mdi--person-arrow-left-outline {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M17 18h4v-2h-4v-2l-3 3l3 3zM11 4C8.8 4 7 5.8 7 8s1.8 4 4 4s4-1.8 4-4s-1.8-4-4-4m0 2c1.1 0 2 .9 2 2s-.9 2-2 2s-2-.9-2-2s.9-2 2-2m0 7c-2.7 0-8 1.3-8 4v3h9.5c-.3-.6-.4-1.2-.5-1.9H4.9V17c0-.6 3.1-2.1 6.1-2.1c.5 0 1 .1 1.5.1c.3-.6.6-1.2 1.1-1.7c-1-.2-1.9-.3-2.6-.3'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
	.prompt-card {
		background: #ffffff;
		padding: 1.5rem;
		border-radius: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border: 0;
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.purpose {
		font-family: 'Bureau Grot', 'Space Grotesk', sans-serif;
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
