<script lang="ts">
	import { goto, pushState } from '$app/navigation';
	import { page } from '$app/state';
	import ContentEditableText from '$lib/components/inline-edit/ContentEditableText.svelte';
	import type { HybridContentSectionProps } from '$lib/page-builder/sections/types';
	import { SvelteSet } from 'svelte/reactivity';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';
	import DirectAccess from './DirectAccess.svelte';
	import { saveHybridContentSectionField } from './HybridContentSectionInlineEdit.remote';

	let {
		props,
		mailtoHref = 'mailto:speaker@christophholz.com',
		campaignId = null,
		campaignPageId = null,
		editable = false,
		sectionIndex = -1,
		onInlineEditSaved,
		disableScrollReveal = false
	}: {
		props?: HybridContentSectionProps;
		mailtoHref?: string;
		campaignId?: number | null;
		campaignPageId?: number | null;
		editable?: boolean;
		sectionIndex?: number;
		onInlineEditSaved?: (() => Promise<void>) | undefined;
		disableScrollReveal?: boolean;
	} = $props();
	let scrollY = $state(0);
	let innerHeight = $state(0);
	let itemRefs = $state<HTMLElement[]>([]);
	let visibleItems = new SvelteSet<number>();
	const revealOffset = 0;

	$effect(() => {
		if (disableScrollReveal) {
			return;
		}

		scrollY;
		innerHeight;

		for (const [index, el] of itemRefs.entries()) {
			if (!el || visibleItems.has(index)) continue;

			const rect = el.getBoundingClientRect();
			const isInView = rect.top < innerHeight + revealOffset && rect.bottom > 0;

			if (isInView) {
				visibleItems.add(index);
			}
		}
	});

	const title = $derived(props?.title ?? 'Bridging the AI-Workforce Gap');
	const intro = $derived(
		props?.intro ??
			'This section clarifies what your audience will leave with from this format and topic, then shows why Christoph is uniquely qualified to deliver those outcomes.'
	);
	const deepDiveTitle = $derived(props?.deepDiveTitle ?? 'Why Christoph');
	const benefits = $derived(props?.benefits ?? []);
	const deepDiveItems = $derived(props?.deepDiveItems ?? []);
	const primaryVisual = $derived(
		props?.primaryVisual ??
			(props as { supportingVisualItems?: { imageUrl: string; alt: string }[] })
				?.supportingVisualItems?.[0]
	);
	const emailCtaTitle = $derived(props?.emailCtaTitle ?? 'Send an email right now');

	type HybridFieldTarget =
		| { kind: 'title' }
		| { kind: 'intro' }
		| { kind: 'deepDiveTitle' }
		| { kind: 'emailCtaTitle' }
		| { kind: 'benefitTitle'; index: number }
		| { kind: 'benefitBody'; index: number }
		| { kind: 'deepDiveItemTitle'; index: number }
		| { kind: 'deepDiveItemBody'; index: number };

	const canInlineEdit = $derived(
		editable && campaignId != null && campaignPageId != null && sectionIndex >= 0
	);

	async function saveHybridField(
		target: HybridFieldTarget,
		nextValue: string
	): Promise<{ saved: boolean; nextValue?: string; nextCampaignPageId?: number }> {
		if (!canInlineEdit || campaignId == null || campaignPageId == null || sectionIndex < 0) {
			return { saved: false };
		}

		const result = await saveHybridContentSectionField({
			campaignId,
			campaignPageId,
			sectionIndex,
			sectionType: 'hybrid_content_section',
			target,
			value: nextValue
		});

		if (result.saved && result.campaignPageId !== campaignPageId) {
			const nextUrl = new URL(page.url);
			nextUrl.searchParams.set('version', String(result.campaignPageId));
			await goto(nextUrl.pathname + nextUrl.search, { invalidateAll: true, keepFocus: true });
		} else if (result.saved) {
			await onInlineEditSaved?.();
		}

		return {
			saved: result.saved,
			nextValue: result.value,
			nextCampaignPageId: result.campaignPageId
		};
	}

	function openHybridImagePicker(): void {
		if (!canInlineEdit || campaignId == null || campaignPageId == null || sectionIndex < 0) {
			return;
		}

		pushState('', {
			...page.state,
			modal: {
				kind: 'hybrid-image-picker',
				campaignId,
				campaignPageId,
				sectionIndex
			}
		});
	}
</script>

<svelte:window bind:scrollY bind:innerHeight />
<section
	class="bg-surface-container relative px-6 py-20 sm:px-8 lg:px-12 lg:py-28"
	aria-label="Hybrid Content section"
>
	<SectionIdentifier props={{ id: 'hybrid_content_section' }}></SectionIdentifier>
	<div class="mx-auto max-w-7xl">
		<div class="mb-14 grid items-end gap-8 lg:mb-20 lg:grid-cols-12 lg:gap-12">
			<div class="space-y-6 lg:col-span-8">
				<ContentEditableText
					as="h2"
					value={title}
					editable={canInlineEdit}
					className="text-4xl leading-[0.95] font-bold tracking-tight text-on-surface lg:text-6xl"
					onSave={(value) => saveHybridField({ kind: 'title' }, value)}
				/>
				<ContentEditableText
					as="p"
					value={intro}
					editable={canInlineEdit}
					multiline={true}
					className="max-w-3xl text-lg leading-relaxed text-on-surface/80 lg:text-2xl"
					onSave={(value) => saveHybridField({ kind: 'intro' }, value)}
				/>
			</div>
			<div class="lg:col-span-4 lg:flex lg:justify-end">
				<span class="block h-0.5 w-16 bg-primary"></span>
			</div>
		</div>

		{#if benefits.length > 0}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each benefits as benefit, index (`hybrid-benefit-${benefit.title}`)}
					<article
						data-reveal-index={index}
						class={[
							'relative flex h-full flex-col gap-4 transition-all duration-500 ease-out',
							disableScrollReveal || visibleItems.has(index)
								? 'translate-y-0 opacity-100'
								: 'translate-y-8 opacity-0'
						]}
						style={`transition-delay: ${index * 120}ms`}
						bind:this={itemRefs[index]}
					>
						<span>0{index + 1}</span>

						<!--<img
							src={benefit.imageUrl ?? '/momentum.png'}
							alt={benefit.title}
							class="aspect-4/2 object-cover"
						/>-->
						<ContentEditableText
							as="h3"
							value={benefit.title}
							editable={canInlineEdit}
							className="text-3xl leading-tight font-bold tracking-tight text-on-surface"
							onSave={(value) => saveHybridField({ kind: 'benefitTitle', index }, value)}
						/>
						<ContentEditableText
							as="p"
							value={benefit.body}
							editable={canInlineEdit}
							multiline={true}
							className="text-base leading-relaxed text-on-surface/75"
							onSave={(value) => saveHybridField({ kind: 'benefitBody', index }, value)}
						/>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</section>

<section class="overflow-hidden bg-on-surface px-6 pt-20 text-surface sm:px-8 lg:px-12 lg:pt-28">
	<div class="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-16">
		<div>
			<ContentEditableText
				as="h2"
				value={deepDiveTitle}
				editable={canInlineEdit}
				className="mb-10 text-4xl leading-[0.95] font-bold tracking-tight lg:text-6xl"
				onSave={(value) => saveHybridField({ kind: 'deepDiveTitle' }, value)}
			/>
			{#if deepDiveItems.length > 0}
				<div class="space-y-10">
					{#each deepDiveItems as item, index (`hybrid-deep-dive-${item.title}`)}
						<div
							data-reveal-index={index + benefits.length}
							class={[
								'flex gap-4 transition-all duration-500 ease-out sm:gap-6',
								disableScrollReveal || visibleItems.has(index + benefits.length)
									? 'translate-y-0 opacity-100'
									: 'translate-y-8 opacity-0'
							]}
							style={`transition-delay: ${index * 120}ms`}
							bind:this={itemRefs[index + benefits.length]}
						>
							<span class="text-lg text-primary">{`0${index + 1}`}</span>
							<div>
								<ContentEditableText
									as="h4"
									value={item.title}
									editable={canInlineEdit}
									className="mb-2 text-2xl leading-tight font-bold tracking-tight"
									onSave={(value) => saveHybridField({ kind: 'deepDiveItemTitle', index }, value)}
								/>
								<ContentEditableText
									as="p"
									value={item.body}
									editable={canInlineEdit}
									multiline={true}
									className="text-base leading-relaxed text-surface/75 lg:text-lg"
									onSave={(value) => saveHybridField({ kind: 'deepDiveItemBody', index }, value)}
								/>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="group relative">
			<div
				class="flex aspect-square items-center justify-center border border-surface/20 bg-surface/5 p-6"
			>
				<div class="absolute h-3/4 w-3/4 bg-primary/20 blur-3xl"></div>
				{#if primaryVisual}
					<img
						src={primaryVisual.imageUrl}
						alt={primaryVisual.alt}
						class="relative z-10 h-full w-full object-cover"
					/>
				{:else}
					<div class="relative z-10 p-10 text-center">
						<span class="material-symbols-outlined mb-4 text-7xl text-primary">hub</span>
						<p class="text-sm tracking-[0.2em] text-primary">Neural Network Analysis</p>
					</div>
				{/if}
			</div>
			{#if canInlineEdit}
				<button
					type="button"
					onclick={openHybridImagePicker}
					class="absolute top-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface/92 text-on-surface opacity-0 shadow-lg transition group-hover:opacity-100 focus:opacity-100"
					aria-label="Change hybrid primary visual"
				>
					<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true">
						<path
							d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
						></path>
						<path d="M13 7l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
						></path>
					</svg>
				</button>
			{/if}
		</div>
	</div>
</section>

<DirectAccess
	props={{ mailtoHref, emailCtaTitle }}
	{campaignId}
	{campaignPageId}
	editable={canInlineEdit}
	onSaveEmailCtaTitle={(value) => saveHybridField({ kind: 'emailCtaTitle' }, value)}
></DirectAccess>
