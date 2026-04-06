<svelte:head>
	<title>Prompt Library</title>
</svelte:head>

<section class="library-shell">
	<h1>Prompt Library</h1>
	<p>
		Manage curated prompts, categories, and reusable assets for all audiences. Every entry captures
		the tone, constraints, and guardrails that keep your Campaign Studio voice consistent.
	</p>
	<p class="hint">
		This section is under construction—expect to find filters, version history, and an approval
		workflow soon.
	</p>
</section>

<style>
	.library-shell {
		margin: 3rem auto;
		max-width: 52rem;
		padding: 2.5rem;
		border-radius: 36px;
		background: linear-gradient(160deg, #fff7f5, #f1d7d0 65%);
		box-shadow: 0 25px 60px rgba(184, 0, 42, 0.09);
		color: #4a2f2f;
	}

	.library-shell h1 {
		margin-bottom: 1rem;
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		font-size: 3.5rem;
		letter-spacing: 0.08em;
	}

	.library-shell p {
		margin: 0;
		font-size: 1rem;
		line-height: 1.7;
	}

	.library-shell .hint {
		margin-top: 1rem;
		font-size: 0.85rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #9b4d4d;
	}
</style>
