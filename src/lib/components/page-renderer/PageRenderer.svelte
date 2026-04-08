<script lang="ts">
	import { sectionRegistry } from '$lib/page-builder/sections';
	import type { PageSection } from '$lib/page-builder/sections';
	import type { LandingPageDocument } from '$lib/page-builder/page';

	let {
		page,
		sections
	}: {
		page?: LandingPageDocument;
		sections?: PageSection[];
	} = $props();

	let renderedSections = $derived(page?.sections ?? sections ?? []);
</script>

{#each renderedSections as section, index (`${section.type}-${index}`)}
	{@const entry = sectionRegistry[section.type]}
	{@const SectionComponent = entry?.component}

	{#if SectionComponent}
		<SectionComponent props={section.props} />
	{:else}
		<section aria-label="Unsupported section">
			<p>Unsupported section: {section.type}</p>
		</section>
	{/if}
{/each}
