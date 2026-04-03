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

<div class="hidden self-start lg:block">
	<AdminSidebar />
</div>
<form method="POST" class="flex flex-col gap-6 bg-white p-6 lg:p-10">
	<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
		<div class="space-y-2">
			<div class="flex items-center gap-1 text-[0.7rem] tracking-[0.3em] text-[#777] uppercase">
				<span>Prompt Library</span>
				<span class="text-[1rem] text-[var(--accent)]">›</span>
				<span>Editor</span>
			</div>
			<h1 class="mt-1 text-[3.5rem] tracking-[-0.03em]">
				Edit Prompt<span class="text-[var(--accent)]">.</span>
			</h1>
			<p class="max-w-[32rem] text-[0.95rem] text-[#5d3f3f]">
				Fine-tune the audience + story guide. Changes go straight into the campaign generator.
			</p>
		</div>
		<div class="self-start">
			<div class="flex items-center gap-4">
				<NavButton variant="outline" href="/admin/prompts">Cancel</NavButton>
				<Button>Save changes</Button>
			</div>
		</div>
	</div>

	{#if displayMessage()}
		<p
			class={`self-start px-3 py-1 text-[0.7rem] tracking-[0.25em] uppercase ${
				getForm()?.success ? 'bg-[#f1f6f1] text-[#007a3d]' : 'bg-[#fdecea] text-[#b8002a]'
			}`}
		>
			{displayMessage()}
		</p>
	{/if}

	<div class="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
		<div class="lg:col-span-7">
			<section class="flex flex-col gap-4">
				<header class="flex items-center gap-4 text-base uppercase">
					<span class="material-symbols--info-outline text-[var(--accent)]"></span>
					<div>Core Information</div>
				</header>
				<div class="bg-white">
					<PromptFormFields values={values()} errors={getForm()?.fieldErrors ?? {}} />
				</div>
			</section>
		</div>

		<div class="flex flex-col gap-6 lg:col-span-5">
			<section class="flex flex-col gap-4 bg-stone-100 p-7">
				<header class="text-accent flex items-center gap-4 text-base uppercase">
					<span
						class="material-symbols--settings-input-component-outline-rounded text-[var(--accent)]"
					></span>
					<div>Metadata</div>
				</header>
				<div class="pt-4">
					<PromptCard {prompt} />
				</div>
			</section>

			<!--	<section class="flex flex-col gap-4 bg-[#191c1e] p-7 text-white">
				<div class="flex items-center justify-between gap-4">
					<div class="flex gap-1">
						<span class="h-2 w-2 bg-[#4f4f52]"></span>
						<span class="h-2 w-2 bg-[#4f4f52]"></span>
						<span class="h-2 w-2 bg-[#4f4f52]"></span>
					</div>
					<div>
						<p>Live Preview</p>
						<p class="text-[0.85rem] text-white/70">{prompt.name}</p>
					</div>
					<span class="material-symbols-outlined">terminal</span>
				</div>
				<div class="font-[family:'Bureau Grot',monospace] mt-4 text-[0.85rem] leading-[1.8]">
					{#each previewLines as line (line.id)}
						<p class="my-2">{line.text}</p>
					{/each}
					<div
						class="mt-4 flex items-center justify-between text-[0.7rem] tracking-[0.3em] uppercase"
					>
						<button
							type="button"
							class="inline-flex items-center gap-1 text-[0.65rem] tracking-[0.3em] text-white uppercase"
						>
							<span class="material-symbols-outlined">refresh</span>
							Re-Generate
						</button>
						<span class="text-white/70">Tokens: {tokensUsed.toLocaleString()}</span>
					</div>
				</div>
			</section>-->

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<article class="bg-stone-50 p-4 text-[0.8rem] tracking-[0.15em] uppercase">
					<p>Clarity Score</p>
					<strong class="mt-2 block text-[1.5rem] text-indigo-500">{clarityScore}%</strong>
				</article>
				<article class="bg-stone-50 p-4 text-[0.8rem] tracking-[0.15em] uppercase">
					<p>Bias Risk</p>
					<strong class="mt-2 block text-[1.5rem] text-indigo-500">{biasRisk}</strong>
				</article>
			</div>
		</div>
	</div>
</form>

<style>
	.material-symbols--info-outline {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M11 17h2v-6h-2zm1.713-8.287Q13 8.425 13 8t-.288-.712T12 7t-.712.288T11 8t.288.713T12 9t.713-.288M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}

	.material-symbols--settings-input-component-outline-rounded {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M3 22v-3.2q-.875-.3-1.437-1.062T1 16V7q0-.425.288-.712T2 6h1V2q0-.425.288-.712T4 1t.713.288T5 2v4h1q.425 0 .713.288T7 7v9q0 .975-.562 1.738T5 18.8V22q0 .425-.288.713T4 23t-.712-.288T3 22m8 0v-3.2q-.875-.3-1.437-1.062T9 16V7q0-.425.288-.712T10 6h1V2q0-.425.288-.712T12 1t.713.288T13 2v4h1q.425 0 .713.288T15 7v9q0 .975-.562 1.738T13 18.8V22q0 .425-.288.713T12 23t-.712-.288T11 22m8 0v-3.2q-.875-.3-1.437-1.062T17 16V7q0-.425.288-.712T18 6h1V2q0-.425.288-.712T20 1t.713.288T21 2v4h1q.425 0 .713.288T23 7v9q0 .975-.562 1.738T21 18.8V22q0 .425-.288.713T20 23t-.712-.288T19 22M3 8v4h2V8zm8 0v4h2V8zm8 0v4h2V8zM4 17q.425 0 .713-.288T5 16v-2H3v2q0 .425.288.713T4 17m8 0q.425 0 .713-.288T13 16v-2h-2v2q0 .425.288.713T12 17m8 0q.425 0 .713-.288T21 16v-2h-2v2q0 .425.288.713T20 17m0-4'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
