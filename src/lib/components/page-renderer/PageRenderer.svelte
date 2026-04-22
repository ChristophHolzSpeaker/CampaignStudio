<script lang="ts">
	import { sectionRegistry } from '$lib/page-builder/sections';
	import type { PageSection } from '$lib/page-builder/sections';
	import type { LandingPageDocument } from '$lib/page-builder/page';

	let {
		page,
		sections,
		campaignId,
		campaignPageId
	}: {
		page?: LandingPageDocument;
		sections?: PageSection[];
		campaignId?: number | null;
		campaignPageId?: number | null;
	} = $props();

	let renderedSections = $derived(page?.sections ?? sections ?? []);
</script>

<main class="col-span-2 pt-10 lg:pt-20">
	{#each renderedSections as section, index (`${section.type}-${index}`)}
		{@const entry = sectionRegistry[section.type]}
		{@const SectionComponent = entry?.component}

		{#if SectionComponent}
			<SectionComponent props={section.props} {campaignId} {campaignPageId} />
		{:else}
			<section aria-label="Unsupported section">
				<p>Unsupported section: {section.type}</p>
			</section>
		{/if}
	{/each}
</main>
