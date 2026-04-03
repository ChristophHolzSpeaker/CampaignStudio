<script lang="ts">
	import AdminHeader from '$lib/components/AdminShellHeader.svelte';
	import AdminSidebar from '$lib/components/AdminSidebar.svelte';
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';
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

	const audienceTags = prompt.audience
		? prompt.audience
				.split(',')
				.map((tag: string) => tag.trim())
				.filter(Boolean)
		: [];

	const metadataList = [
		{ label: 'Purpose', value: prompt.purpose ?? 'TBD' },
		{ label: 'Model', value: prompt.model ?? 'Undecided' },
		{ label: 'Topic', value: prompt.topic ?? 'General' }
	];

	const previewLines = [
		{
			id: 'system',
			text: prompt.system_prompt
				? prompt.system_prompt.replace(/\s+/g, ' ').slice(0, 90)
				: 'System guard rails are awake.'
		},
		{
			id: 'template',
			text: prompt.user_prompt_template
				? prompt.user_prompt_template.replace(/\s+/g, ' ').slice(0, 90)
				: 'Awaiting user prompt template.'
		},
		{ id: 'status', text: 'Analysis status: COMPLIANT' }
	];

	const clarityScore = 94;
	const biasRisk = 'Low';
	const tokensUsed = 1420;
</script>

<svelte:head>
	<title>Edit prompt</title>
</svelte:head>

<div class="sidebar-column">
	<AdminSidebar />
</div>
<form method="POST" class="editor-form">
	<div class="hero-panel">
		<div>
			<div class="breadcrumb flex items-center">
				<span>Prompt Library</span>
				<span class="chevron">›</span>
				<span class="active">Editor</span>
			</div>
			<h1>
				Edit Prompt<span>.</span>
			</h1>
			<p class="subtitle">
				Fine-tune the audience + story guide. Changes go straight into the campaign generator.
			</p>
		</div>
		<div class="hero-actions">
			<div class="action-buttons items-center">
				<NavButton variant="outline" href="/admin/prompts">Cancel</NavButton>
				<Button>Save changes</Button>
			</div>
		</div>
	</div>

	{#if displayMessage()}
		<p class={`status-pill ${getForm()?.success ? 'success' : 'error'}`}>{displayMessage()}</p>
	{/if}

	<div class="editor-grid">
		<div class="primary-column">
			<section class="panel">
				<header class="panel-head">
					<span class="material-symbols-outlined">info</span>
					<div>
						<p>Core Information</p>
						<small>Dial in the essentials</small>
					</div>
				</header>
				<div class="panel-body">
					<PromptFormFields values={values()} errors={getForm()?.fieldErrors ?? {}} />
				</div>
			</section>
		</div>

		<div class="secondary-column">
			<section class="panel metadata-panel">
				<header class="panel-head">
					<span class="material-symbols-outlined">settings_input_component</span>
					<div>
						<p>Metadata</p>
						<small>Contextual cues</small>
					</div>
				</header>
				<div class="prompt-card-wrapper">
					<PromptCard {prompt} />
				</div>
				<div class="tag-row">
					{#if audienceTags.length}
						{#each audienceTags as tag (tag)}
							<span>{tag}</span>
						{/each}
					{:else}
						<span>Audience TBD</span>
					{/if}
				</div>
				<div class="meta-grid">
					{#each metadataList as item (item.label)}
						<div class="meta-row">
							<p>{item.label}</p>
							<strong>{item.value}</strong>
						</div>
					{/each}
				</div>
				{#if metadataValue}
					<p class="metadata-note">{metadataValue}</p>
				{/if}
				<div class="summary-block">
					<p>System prompt summary</p>
					<p>{prompt.system_prompt ?? 'No system prompt provided yet.'}</p>
				</div>
			</section>

			<section class="panel live-panel">
				<div class="live-header">
					<div class="live-dots">
						<span></span>
						<span></span>
						<span></span>
					</div>
					<div>
						<p>Live Preview</p>
						<p class="live-caption">{prompt.name}</p>
					</div>
					<span class="material-symbols-outlined">terminal</span>
				</div>
				<div class="live-body">
					{#each previewLines as line (line.id)}
						<p>{line.text}</p>
					{/each}
					<div class="live-footer">
						<button type="button" class="ghost-link">
							<span class="material-symbols-outlined">refresh</span>
							Re-Generate
						</button>
						<span class="token-count">Tokens: {tokensUsed.toLocaleString()}</span>
					</div>
				</div>
			</section>

			<div class="health-grid">
				<article>
					<p>Clarity Score</p>
					<strong>{clarityScore}%</strong>
				</article>
				<article>
					<p>Bias Risk</p>
					<strong>{biasRisk}</strong>
				</article>
			</div>
		</div>
	</div>

	<div class="autosave-toast">
		<span></span>
		<p>Autosaved moments ago</p>
		<button type="button" class="toast-dismiss">Dismiss</button>
	</div>
</form>

<style>
	.sidebar-column {
		align-self: start;
	}

	.editor-form {
		background: #ffffff;
		padding: 2.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.hero-panel {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: flex-end;
	}

	.hero-panel h1 {
		font-size: 3.5rem;
		letter-spacing: -0.03em;
		margin: 0.4rem 0 0;
	}

	.hero-panel h1 span {
		color: var(--accent);
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.3em;
		font-size: 0.7rem;
		margin-bottom: 0.4rem;
	}

	.subtitle {
		max-width: 32rem;
		color: #5d3f3f;
		font-size: 0.95rem;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: #777;
	}

	.breadcrumb .chevron {
		font-size: 1rem;
		color: var(--accent);
	}

	.hero-actions {
		align-self: flex-start;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
	}

	.ghost-action {
		border: 1px solid rgba(0, 0, 0, 0.2);
		padding: 0.8rem 1.3rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		text-decoration: none;
		color: #1a1c1c;
		background: none;
	}

	.primary-action {
		background: linear-gradient(135deg, #b8002a, #e2183b);
		border: none;
		padding: 0.8rem 1.7rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: #fff;
	}

	.status-pill {
		text-transform: uppercase;
		letter-spacing: 0.25em;
		font-size: 0.7rem;
		padding: 0.35rem 0.75rem;
		align-self: flex-start;
	}

	.status-pill.success {
		color: #007a3d;
		background: #f1f6f1;
	}

	.status-pill.error {
		color: #b8002a;
		background: #fdecea;
	}

	.editor-grid {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 1.5rem;
	}

	.primary-column {
		grid-column: span 7 / span 7;
	}

	.secondary-column {
		grid-column: span 5 / span 5;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.panel {
		background: #f3f3f3;
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.panel-head {
		display: flex;
		gap: 1rem;
		align-items: center;
		text-transform: uppercase;
		letter-spacing: 0.25em;
		font-size: 0.8rem;
	}

	.panel-body {
		background: #ffffff;
		padding: 1.5rem;
	}

	.prompt-card-wrapper {
		border-top: 1px solid rgba(0, 0, 0, 0.1);
		padding-top: 1rem;
	}

	.tag-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag-row span {
		background: #ffffff;
		padding: 0.45rem 0.9rem;
		font-size: 0.65rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.meta-row p {
		margin: 0;
		font-size: 0.6rem;
		letter-spacing: 0.2em;
	}

	.meta-row strong {
		display: block;
		margin-top: 0.25rem;
		font-size: 1rem;
	}

	.metadata-note {
		font-size: 0.85rem;
		color: #555;
		margin: 0;
	}

	.summary-block {
		margin-top: 1rem;
		font-size: 0.85rem;
		color: #333;
		border-top: 1px solid rgba(0, 0, 0, 0.05);
		padding-top: 1rem;
	}

	.summary-block p:last-of-type {
		font-family: 'Bureau Grot', sans-serif;
		font-size: 0.9rem;
		margin: 0.3rem 0 0;
	}

	.live-panel {
		background: #191c1e;
		color: #f8f9fb;
	}

	.live-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.live-dots {
		display: flex;
		gap: 0.35rem;
	}

	.live-dots span {
		width: 0.65rem;
		height: 0.65rem;
		background: #4f4f52;
	}

	.live-caption {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.live-body {
		margin-top: 1rem;
		font-family: 'Bureau Grot', monospace;
		font-size: 0.85rem;
		line-height: 1.8;
	}

	.live-body p {
		margin: 0.45rem 0;
	}

	.live-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1rem;
		font-size: 0.7rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
	}

	.ghost-link {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: none;
		background: transparent;
		color: #f8f9fb;
		text-transform: uppercase;
		letter-spacing: 0.3em;
		font-size: 0.65rem;
	}

	.token-count {
		color: rgba(255, 255, 255, 0.5);
	}

	.health-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.health-grid article {
		background: #eceef0;
		padding: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.15em;
	}

	.health-grid article strong {
		display: block;
		font-size: 1.5rem;
		color: var(--accent);
	}

	.autosave-toast {
		margin-top: 1.5rem;
		padding: 0.8rem 1rem;
		background: #f3f3f3;
		display: flex;
		align-items: center;
		justify-content: space-between;
		text-transform: uppercase;
		letter-spacing: 0.2em;
	}

	.autosave-toast span {
		width: 0.5rem;
		height: 0.5rem;
		background: #0f6d45;
	}

	.toast-dismiss {
		border: none;
		background: transparent;
		color: #b8002a;
		font-size: 0.65rem;
		letter-spacing: 0.3em;
	}

	@media (max-width: 1200px) {
		.editor-form {
			padding: 1.5rem;
		}

		.sidebar-column {
			display: none;
		}

		.editor-grid {
			grid-template-columns: 1fr;
		}

		.primary-column,
		.secondary-column {
			grid-column: span 12;
		}
	}
</style>
