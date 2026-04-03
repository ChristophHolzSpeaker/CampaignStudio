<script>
	import PromptCard from '$lib/components/PromptCard.svelte';
	import PromptFormFields from '$lib/components/PromptFormFields.svelte';

	const props = $props();
	const getData = () => props.data;
	const getForm = () => props.form;
	const prompt = getData().prompt;
	const metadata = prompt.metadata;
	const metadataValue =
		metadata && typeof metadata === 'object' && 'notes' in metadata
			? String(metadata.notes ?? '')
			: '';

	const defaultValues = {
		name: prompt.name,
		purpose: prompt.purpose,
		audience: prompt.audience,
		format: prompt.format,
		model: prompt.model,
		system_prompt: prompt.system_prompt,
		user_prompt_template: prompt.user_prompt_template,
		topic: prompt.topic,
		metadata: metadataValue,
		is_active: prompt.is_active ? 'true' : 'false'
	};

	const values = () => getForm()?.values ?? defaultValues;
	const displayMessage = () => (getForm()?.success ? 'Prompt updated' : getForm()?.formError);
</script>

<svelte:head>
	<title>Edit prompt</title>
</svelte:head>

<section class="edit-panel">
	<div class="column">
		<p class="eyebrow">Prompt Library</p>
		<h1>Edit prompt</h1>
		<p>
			Fine-tune the audience/form style guide. Changes flow straight into the campaign generator.
		</p>
	</div>
	<div class="column">
		<PromptCard {prompt} />
		<div class="preview-panel">
			<p class="preview-label">System prompt preview</p>
			<p class="preview-text">{prompt.system_prompt}</p>
			<p class="preview-label">User prompt template</p>
			<p class="preview-text">{prompt.user_prompt_template}</p>
		</div>
	</div>
</section>

<form method="POST" class="form-card">
	{#if displayMessage()}
		<p class:success={getForm()?.success} class:error={!getForm()?.success}>{displayMessage()}</p>
	{/if}

	<PromptFormFields values={values()} errors={getForm()?.fieldErrors ?? {}} />

	<div class="actions">
		<button type="submit" class="primary-cta">Save changes</button>
		<a href="/admin/prompts" class="outline-link">Cancel</a>
	</div>
</form>

<style>
	.edit-panel {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.column h1 {
		margin: 0.5rem 0;
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		text-transform: uppercase;
		font-size: 2.3rem;
	}

	.preview-label {
		margin: 0.6rem 0 0.2rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-size: 0.75rem;
	}

	.preview-text {
		margin: 0;
		font-family: 'Bureau Grot', 'Space Grotesk', sans-serif;
		line-height: 1.8;
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

	.primary-cta {
		background: linear-gradient(135deg, #b8002a, #e2183b);
		border: 0;
		padding: 0.9rem 2.3rem;
		color: #ffffff;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
	}

	.outline-link {
		color: #1a1c1c;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		text-decoration: none;
	}

	.form-card p.success {
		color: #0f6d45;
	}

	.form-card p.error {
		color: #b8002a;
	}
</style>
