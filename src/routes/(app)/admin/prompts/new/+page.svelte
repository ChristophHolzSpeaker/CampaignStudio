<script>
	import { enhance } from '$app/forms';
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';
	import PromptFormFields from '$lib/components/PromptFormFields.svelte';

	const { form } = $props();
	$inspect(form?.fieldErrors);
</script>

<svelte:head>
	<title>New Prompt</title>
</svelte:head>

<section class="panel">
	<div class="panel-copy">
		<p class="eyebrow">Prompt Library</p>
		<h1>Create a prompt</h1>
		<p>Seed the system prompt that will serve future campaigns with this audience and format.</p>
	</div>
	<form use:enhance method="POST" class="form-card">
		{#if form?.formError}
			<p class="error">{form.formError}</p>
		{/if}

		<PromptFormFields values={form?.values ?? {}} errors={form?.fieldErrors ?? {}} />

		<div class="actions">
			<NavButton variant="outline" href="/admin/prompts">Back to library</NavButton>
			<Button>Save prompt</Button>
		</div>
	</form>
</section>

<style>
	.panel {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 2rem;
		padding: 3rem;
	}

	.panel-copy h1 {
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		font-size: 2.75rem;
		text-transform: uppercase;
	}

	.panel-copy p {
		font-family: 'Bureau Grot', 'Space Grotesk', sans-serif;
		line-height: 1.7;
	}

	.form-card {
		background: #ffffff;
		padding: 2rem;
	}

	.actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1.5rem;
	}

	.error {
		color: #b8002a;
		margin-bottom: 1rem;
	}
</style>
