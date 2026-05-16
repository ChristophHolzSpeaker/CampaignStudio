<script lang="ts">
	import { sectionRegistry } from '$lib/page-builder/sections';
	import type { PageSection } from '$lib/page-builder/sections';
	import type { LandingPageDocument } from '$lib/page-builder/page';
	import { page as appPage } from '$app/state';
	let {
		page,
		sections,
		campaignId,
		campaignPageId,
		editable = false,
		onInlineEditSaved,
		mailtoHref,
		bookingSlotGroups,
		disableScrollReveal = false
	}: {
		page?: LandingPageDocument;
		sections?: PageSection[];
		campaignId?: number | null;
		campaignPageId?: number | null;
		editable?: boolean;
		onInlineEditSaved?: (() => Promise<void>) | undefined;
		mailtoHref?: string;
		bookingSlotGroups?: { dateKey: string; slots: { startsAtIso: string; endsAtIso: string }[] }[];
		disableScrollReveal?: boolean;
	} = $props();

	let renderedSections = $derived(page?.sections ?? sections ?? []);
</script>

<main class={['col-span-2', appPage.route?.id?.startsWith('/(app)') ? '' : 'pt-10 lg:pt-20']}>
	{#each renderedSections as section, index (`${section.type}-${index}`)}
		{@const entry = sectionRegistry[section.type]}
		{@const SectionComponent = entry?.component}

		{#if SectionComponent}
			{#if section.type === 'hybrid_content_section' || section.type === 'keynote_speeches'}
				<SectionComponent
					props={section.props}
					{campaignId}
					{campaignPageId}
					{editable}
					{onInlineEditSaved}
					sectionIndex={index}
					{mailtoHref}
					{bookingSlotGroups}
					{disableScrollReveal}
				/>
			{:else}
				<SectionComponent
					props={section.props}
					{campaignId}
					{campaignPageId}
					{editable}
					{onInlineEditSaved}
					sectionIndex={index}
					{mailtoHref}
					{bookingSlotGroups}
				/>
			{/if}
		{:else}
			<section aria-label="Unsupported section">
				<p>Unsupported section: {section.type}</p>
			</section>
		{/if}
	{/each}
</main>
