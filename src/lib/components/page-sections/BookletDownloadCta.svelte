<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ContentEditableText from '$lib/components/inline-edit/ContentEditableText.svelte';
	import type { BookletDownloadCtaProps } from '$lib/page-builder/sections/types';
	import Button from '../elements/Button.svelte';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';
	import { saveBookletDownloadCtaField } from './BookletDownloadCtaInlineEdit.remote';

	let {
		props,
		campaignId = null,
		campaignPageId = null,
		editable = false,
		sectionIndex = -1,
		onInlineEditSaved
	}: {
		props?: BookletDownloadCtaProps;
		campaignId?: number | null;
		campaignPageId?: number | null;
		editable?: boolean;
		sectionIndex?: number;
		onInlineEditSaved?: (() => Promise<void>) | undefined;
	} = $props();

	const canInlineEdit = $derived(
		editable && campaignId != null && campaignPageId != null && sectionIndex >= 0
	);
	const labelText = $derived(props?.labelText ?? 'Booklet');
	const heading = $derived(props?.heading ?? 'Download the keynote booklet');
	const paragraph = $derived(
		props?.paragraph ?? 'Get the full keynote profile, audience outcomes, and booking details.'
	);
	const buttonCtaText = $derived(props?.buttonCtaText ?? 'Download Booklet');

	async function saveBookletField(
		field: 'labelText' | 'heading' | 'paragraph' | 'buttonCtaText',
		nextValue: string
	): Promise<{ saved: boolean; nextValue?: string; nextCampaignPageId?: number }> {
		if (!canInlineEdit || campaignId == null || campaignPageId == null || sectionIndex < 0) {
			return { saved: false };
		}

		const result = await saveBookletDownloadCtaField({
			campaignId,
			campaignPageId,
			sectionIndex,
			sectionType: 'booklet_download_cta',
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
</script>

<section
	class="relative overflow-hidden bg-on-surface px-6 py-20 text-surface sm:px-8 lg:px-12 lg:py-28"
>
	<SectionIdentifier props={{ id: 'booklet_download_cta' }}></SectionIdentifier>
	<div class="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-16">
		<div class="relative">
			<div
				class="flex aspect-square items-center justify-center border border-surface/20 bg-surface/5 p-6"
			>
				<div class="absolute h-3/4 w-3/4 bg-primary/20 blur-3xl"></div>

				<img
					src="/christoph-holz-keynote-speaker-booklet-mockup.webp"
					alt="Christoph Holz Keynote Speaker Booklet"
					class="relative z-10 h-full w-full object-cover"
				/>
			</div>
		</div>
		<div>
			<div class="space-y-10">
				<div class="flex gap-4 sm:gap-6">
					<div>
						<ContentEditableText
							as="span"
							value={labelText}
							editable={canInlineEdit}
							className="font-label-bold text-label-bold mb-6 inline-block bg-primary px-4 py-1 text-sm text-white"
							onSave={(value) => saveBookletField('labelText', value)}
						/>
						<ContentEditableText
							as="h2"
							value={heading}
							editable={canInlineEdit}
							className="mb-10 text-4xl leading-[0.95] font-bold tracking-tight lg:text-7xl"
							onSave={(value) => saveBookletField('heading', value)}
						/>

						<ContentEditableText
							as="p"
							value={paragraph}
							editable={canInlineEdit}
							multiline={true}
							className="text-base leading-relaxed text-surface/75 lg:text-lg"
							onSave={(value) => saveBookletField('paragraph', value)}
						/>
						<div class="mt-10">
							<Button>
								<ContentEditableText
									as="span"
									value={buttonCtaText}
									editable={canInlineEdit}
									onSave={(value) => saveBookletField('buttonCtaText', value)}
								/>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
