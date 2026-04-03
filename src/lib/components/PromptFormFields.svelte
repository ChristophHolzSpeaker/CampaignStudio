<script>
	import { audienceOptions, formatOptions, purposeOptions } from '$lib/constants/prompts';
	import Input from '$lib/components/elements/Input.svelte';
	import Select from '$lib/components/elements/Select.svelte';
	import TextArea from '$lib/components/elements/TextArea.svelte';

	const props = $props();
	const values = () => props.values ?? {};
	const errors = () => props.errors ?? {};
	const isActive = () => values().is_active === 'true';
</script>

<div class="grid gap-8">
	<div class="grid gap-8">
		<Input
			id="prompt-name"
			name="name"
			label="Name"
			value={values().name ?? ''}
			error={errors().name}
		/>
	</div>
	<div class="grid grid-cols-2 gap-8">
		<Select
			id="purpose"
			name="purpose"
			label="Purpose"
			options={purposeOptions}
			placeholder="Select purpose"
			value={values().purpose ?? ''}
			error={errors().purpose}
		/>
		<Select
			id="audience"
			name="audience"
			label="Audience"
			options={audienceOptions}
			placeholder="Select audience"
			value={values().audience ?? ''}
			error={errors().audience}
		/>
		<Select
			id="format"
			name="format"
			label="Format"
			options={formatOptions}
			placeholder="Select format"
			value={values().format ?? ''}
			error={errors().format}
		/>
		<Input id="topic" name="topic" label="Topic (optional)" value={values().topic ?? ''} />
	</div>

	<div class="grid gap-8">
		<Input
			id="model"
			name="model"
			label="Model"
			value={values().model ?? 'google/gemini-3.1-flash-lite-preview'}
			error={errors().model}
		/>

		<TextArea
			id="system_prompt"
			name="system_prompt"
			label="System Prompt"
			rows={5}
			value={values().system_prompt ?? ''}
			error={errors().system_prompt}
		/>

		<TextArea
			id="user_prompt_template"
			name="user_prompt_template"
			label="User Prompt Template"
			rows={4}
			value={values().user_prompt_template ?? ''}
			error={errors().user_prompt_template}
		/>

		<TextArea
			id="metadata"
			name="metadata"
			label="Metadata (optional)"
			rows={3}
			value={values().metadata ?? ''}
		/>

		<label class="checkbox-row">
			<input type="checkbox" name="is_active" checked={isActive()} />
			<span>Activate prompt</span>
		</label>
	</div>
</div>

<style>
	.checkbox-row {
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		font-size: 0.7rem;
	}

	input[type='checkbox'] {
		width: 1.2rem;
		height: 1.2rem;
	}
</style>
