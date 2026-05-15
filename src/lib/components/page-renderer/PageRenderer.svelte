<script lang="ts">
	import { sectionRegistry } from '$lib/page-builder/sections';
	import type { PageSection } from '$lib/page-builder/sections';
	import type { LandingPageDocument } from '$lib/page-builder/page';

	let {
		page,
		sections,
		campaignId,
		campaignPageId,
		mailtoHref,
		bookingSlotGroups,
		disableScrollReveal = false
	}: {
		page?: LandingPageDocument;
		sections?: PageSection[];
		campaignId?: number | null;
		campaignPageId?: number | null;
		mailtoHref?: string;
		bookingSlotGroups?: { dateKey: string; slots: { startsAtIso: string; endsAtIso: string }[] }[];
		disableScrollReveal?: boolean;
	} = $props();

	let renderedSections = $derived(page?.sections ?? sections ?? []);
</script>

<main class="col-span-2 pt-10 lg:pt-20">
	{#each renderedSections as section, index (`${section.type}-${index}`)}
		{@const entry = sectionRegistry[section.type]}
		{@const SectionComponent = entry?.component}

		{#if SectionComponent}
			{#if section.type === 'hybrid_content_section' || section.type === 'keynote_speeches'}
				<SectionComponent
					props={section.props}
					{campaignId}
					{campaignPageId}
					{mailtoHref}
					{bookingSlotGroups}
					{disableScrollReveal}
				/>
			{:else}
				<SectionComponent
					props={section.props}
					{campaignId}
					{campaignPageId}
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
