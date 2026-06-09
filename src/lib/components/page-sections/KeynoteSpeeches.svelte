<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ContentEditableText from '$lib/components/inline-edit/ContentEditableText.svelte';
	import Button from '../elements/Button.svelte';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';
	import { getAdditionalKeynotes } from './KeynoteSpeeches.remote';
	import { saveKeynoteSpeechesField } from './KeynoteSpeechesInlineEdit.remote';
	import { SvelteSet } from 'svelte/reactivity';

	type Keynote = {
		id: string;
		title: string;
		imageUrl: string;
		summary: string;
	};

	type KeynoteSpeechesSectionProps = {
		title: string;
		intro: string;
		keynoteIds: string[];
		keynotes: Keynote[];
	};

	let {
		props,
		campaignId = null,
		campaignPageId = null,
		editable = false,
		sectionIndex = -1,
		onInlineEditSaved,
		disableScrollReveal = false
	}: {
		props: KeynoteSpeechesSectionProps;
		campaignId?: number | null;
		campaignPageId?: number | null;
		editable?: boolean;
		sectionIndex?: number;
		onInlineEditSaved?: (() => Promise<void>) | undefined;
		disableScrollReveal?: boolean;
	} = $props();

	let scrollY = $state(0);
	let innerHeight = $state(0);
	let sectionEl = $state<HTMLElement | null>(null);
	let visibleItems = new SvelteSet<number>();
	let additionalKeynotes = $state<Keynote[]>([]);
	let loadingMoreKeynotes = $state(false);
	let hasMoreKeynotes = $state(true);
	const revealOffset = 600;
	const canInlineEdit = $derived(
		editable && campaignId != null && campaignPageId != null && sectionIndex >= 0
	);
	const displayedKeynotes = $derived([...props.keynotes, ...additionalKeynotes]);
	const displayedKeynoteIds = $derived([
		...props.keynoteIds,
		...additionalKeynotes.map((keynote) => keynote.id)
	]);

	async function saveKeynoteField(
		field: 'title' | 'intro',
		nextValue: string
	): Promise<{ saved: boolean; nextValue?: string; nextCampaignPageId?: number }> {
		if (!canInlineEdit || campaignId == null || campaignPageId == null || sectionIndex < 0) {
			return { saved: false };
		}

		const result = await saveKeynoteSpeechesField({
			campaignId,
			campaignPageId,
			sectionIndex,
			sectionType: 'keynote_speeches',
			field,
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

	async function loadMoreKeynotes(): Promise<void> {
		if (loadingMoreKeynotes || !hasMoreKeynotes) {
			return;
		}

		loadingMoreKeynotes = true;

		try {
			const nextKeynotes = await getAdditionalKeynotes({ keynoteIds: displayedKeynoteIds });
			additionalKeynotes = [...additionalKeynotes, ...nextKeynotes];
			hasMoreKeynotes = nextKeynotes.length === 3;
		} finally {
			loadingMoreKeynotes = false;
		}
	}

	$effect(() => {
		if (disableScrollReveal) {
			return;
		}

		scrollY;
		innerHeight;

		const revealItems = sectionEl?.querySelectorAll<HTMLElement>('[data-reveal-index]') ?? [];
		for (const el of revealItems) {
			const index = Number(el.dataset.revealIndex);
			if (Number.isNaN(index) || visibleItems.has(index)) continue;

			const rect = el.getBoundingClientRect();
			const isInView = rect.top < innerHeight + revealOffset && rect.bottom > 0;

			if (isInView) {
				visibleItems.add(index);
			}
		}
	});
</script>

<svelte:window bind:scrollY />
<section
	bind:this={sectionEl}
	class="relative bg-surface px-6 py-20 sm:px-8 lg:px-12 lg:py-28"
	aria-label="Hybrid Content section"
>
	<SectionIdentifier props={{ id: 'keynote_speeches' }}></SectionIdentifier>
	<div class="mx-auto max-w-7xl">
		<div class="mb-14 grid items-end gap-8 lg:mb-20 lg:grid-cols-12 lg:gap-12">
			<div class="space-y-6 lg:col-span-8">
				<ContentEditableText
					as="h2"
					value={props.title}
					editable={canInlineEdit}
					className="text-4xl leading-[0.95] font-bold tracking-tight text-on-surface lg:text-6xl"
					onSave={(value) => saveKeynoteField('title', value)}
				/>
				<ContentEditableText
					as="p"
					value={props.intro}
					editable={canInlineEdit}
					multiline={true}
					className="max-w-3xl text-lg leading-relaxed text-on-surface/80 lg:text-2xl"
					onSave={(value) => saveKeynoteField('intro', value)}
				/>
			</div>
			<div class="lg:col-span-4 lg:flex lg:justify-end">
				<span class="block h-0.5 w-16 bg-primary"></span>
			</div>
		</div>

		{#if props.keynotes.length > 0}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each displayedKeynotes as keynote, index (keynote.id)}
					<article
						data-reveal-index={index}
						class={['relative flex h-full flex-col gap-4 transition-all duration-500 ease-out']}
					>
						<span>0{index + 1}</span>

						<img
							src={keynote.imageUrl ?? '/momentum.png'}
							alt={keynote.title}
							class="aspect-4/2 object-cover"
						/>
						<h3 class="text-3xl leading-tight font-bold tracking-tight text-on-surface">
							{keynote.title}
						</h3>
						<p class="text-base leading-relaxed text-on-surface/75">{keynote.summary}</p>
					</article>
				{/each}
			</div>
			{#if hasMoreKeynotes}
				<div class="mt-8 flex justify-center">
					<Button variant="dark" isSubmitting={loadingMoreKeynotes} onclick={loadMoreKeynotes}>
						{loadingMoreKeynotes ? 'Weitere Vorträge werden geladen…' : 'Weitere Vorträge anzeigen'}
					</Button>
				</div>
			{/if}
		{/if}
	</div>
</section>
