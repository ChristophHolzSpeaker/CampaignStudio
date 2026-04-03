<script>
	import { audienceOptions, formatOptions, purposeOptions } from '$lib/constants/prompts';

	const props = $props();
	const values = () => props.values ?? {};
	const errors = () => props.errors ?? {};
	const isActive = () => values().is_active === 'true';
</script>

<div class="field-grid">
	<label class="field" data-error={errors().name ? 'true' : 'false'}>
		<span>Name</span>
		<input name="name" value={values().name ?? ''} />
		{#if errors().name}
			<small>{errors().name}</small>
		{/if}
	</label>

	<label class="field">
		<span>Purpose</span>
		<select name="purpose" value={values().purpose ?? ''}>
			{#each purposeOptions as option}
				<option value={option.value} selected={option.value === values().purpose}
					>{option.label}</option
				>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>Audience</span>
		<select name="audience" value={values().audience ?? ''}>
			{#each audienceOptions as option}
				<option value={option.value} selected={option.value === values().audience}
					>{option.label}</option
				>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>Format</span>
		<select name="format" value={values().format ?? ''}>
			{#each formatOptions as option}
				<option value={option.value} selected={option.value === values().format}
					>{option.label}</option
				>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>Topic (optional)</span>
		<input name="topic" value={values().topic ?? ''} />
	</label>
</div>

<label class="field field--full">
	<span>Model</span>
	<input name="model" value={values().model ?? 'google/gemini-3.1-flash-lite-preview'} />
	{#if errors().model}
		<small>{errors().model}</small>
	{/if}
</label>

<label class="field field--full">
	<span>System Prompt</span>
	<textarea name="system_prompt" rows="5">{values().system_prompt ?? ''}</textarea>
	{#if errors().system_prompt}
		<small>{errors().system_prompt}</small>
	{/if}
</label>

<label class="field field--full">
	<span>User Prompt Template</span>
	<textarea name="user_prompt_template" rows="4">{values().user_prompt_template ?? ''}</textarea>
	{#if errors().user_prompt_template}
		<small>{errors().user_prompt_template}</small>
	{/if}
</label>

<label class="field field--full">
	<span>Metadata (optional)</span>
	<textarea name="metadata" rows="3">{values().metadata ?? ''}</textarea>
</label>

<label class="field field--stretch">
	<input type="checkbox" name="is_active" checked={isActive()} />
	<span>Activate prompt</span>
</label>

<style>
	.field-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-family: 'Bureau Grot', 'Space Grotesk', sans-serif;
		font-size: 0.95rem;
	}

	.field span {
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #5d3f3f;
	}

	.field input,
	.field select,
	.field textarea {
		border: none;
		border-bottom: 2px solid #e2e2e2;
		background: #ffffff;
		padding: 0.6rem 0;
		font-family: inherit;
		font-size: 1rem;
		outline: none;
	}

	.field textarea {
		resize: vertical;
	}

	.field input:focus,
	.field select:focus,
	.field textarea:focus {
		border-bottom-color: #b8002a;
	}

	.field small {
		color: #b8002a;
	}

	.field--full {
		width: 100%;
	}

	.field--stretch {
		flex-direction: row;
		align-items: center;
		gap: 0.8rem;
	}

	input[type='checkbox'] {
		width: 1.2rem;
		height: 1.2rem;
	}
</style>
