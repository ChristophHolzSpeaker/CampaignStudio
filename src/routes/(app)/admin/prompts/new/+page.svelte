<script>
	import { enhance } from '$app/forms';
	import AdminSidebar from '$lib/components/AdminSidebar.svelte';
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';
	import PromptCard from '$lib/components/PromptCard.svelte';
	import PromptFormFields from '$lib/components/PromptFormFields.svelte';

	const { form } = $props();
	const getForm = () => form;
	const clarityScore = 94;
	const biasRisk = 'Low';
	const displayMessage = () => getForm()?.formError;
</script>

<svelte:head>
	<title>New Prompt</title>
</svelte:head>

<div class="hidden self-start lg:block">
	<AdminSidebar />
</div>
<form use:enhance method="POST" class="flex flex-col gap-6 bg-white p-6 lg:p-10">
	<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
		<div class="space-y-2">
			<div class="flex items-center gap-1 text-[0.7rem] tracking-[0.3em] text-[#777] uppercase">
				<span>Prompt Library</span>
				<span class="text-[1rem] text-(--accent)">›</span>
				<span>Editor</span>
			</div>
			<h1 class="mt-1 text-[3.5rem] tracking-[-0.03em]">
				Create Prompt<span class="text-(--accent)">.</span>
			</h1>
			<p class="max-w-[32rem] text-[0.95rem] text-[#5d3f3f]">
				Seed the system prompt that will serve future campaigns with this audience and format
			</p>
		</div>
		<div class="self-start">
			<div class="flex items-center gap-4">
				<NavButton variant="outline" href="/admin/prompts">Cancel</NavButton>
				<Button>Create prompt</Button>
			</div>
		</div>
	</div>

	{#if displayMessage()}
		<p
			class="self-start bg-[#fdecea] px-3 py-1 text-[0.7rem] tracking-[0.25em] text-[#b8002a] uppercase"
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
					<PromptFormFields values={form?.values ?? {}} errors={form?.fieldErrors ?? {}} />
					<div class="mt-6">
						<Button>Create prompt</Button>
					</div>
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
