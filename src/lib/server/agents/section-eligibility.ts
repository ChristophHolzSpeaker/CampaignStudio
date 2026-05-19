import { pageSectionTypes, type PageSectionType } from '$lib/page-builder/sections';
import {
	resolveRequiredSectionTypes,
	sectionDefinitions,
	type SectionDefinition
} from './section-definitions';
import type { LandingPageGenerationInput } from './schemas/landing-page-input';

export type SectionEligibility = {
	allowedSectionTypes: PageSectionType[];
	requiredSectionTypes: PageSectionType[];
	disallowedReasonByType: Partial<Record<PageSectionType, string>>;
};

function evaluateMediaRequirement(
	definition: SectionDefinition,
	input: LandingPageGenerationInput
): string | null {
	switch (definition.media.requirement) {
		case 'none':
			return null;
		case 'hero_defaults':
			return input.assets.heroDefaults.videoEmbedUrl &&
				(input.assets.heroDefaults.heroImageUrl || input.assets.heroDefaults.videoThumbnailUrl)
				? null
				: 'Hero media defaults are missing (video + hero image).';
		case 'logos_any':
			return input.assets.assetCatalog.logoCatalog.length > 0 ||
				input.assets.fixedLogosRibbon.logos.length > 0
				? null
				: 'No active logos or fallback logos are configured.';
		case 'keynotes_min_3':
			return input.assets.assetCatalog.keynoteCatalog.length >= 3
				? null
				: 'At least 3 active keynotes are required in keynote catalog.';
		case 'speaker_videos_min_4':
			return input.assets.assetCatalog.speakerInActionVideos.length >= 4
				? null
				: 'At least 4 YouTube video assets are required.';
		case 'proof_testimonials_any':
			return input.assets.fixedProofOfPerformance.testimonials.length > 0
				? null
				: 'No proof testimonials are configured.';
	}
}

export function getSectionEligibility(input: LandingPageGenerationInput): SectionEligibility {
	const allowedSectionTypes: PageSectionType[] = [];
	const disallowedReasonByType: Partial<Record<PageSectionType, string>> = {};
	const requiredSectionTypes = resolveRequiredSectionTypes();

	for (const sectionType of pageSectionTypes) {
		const definition = sectionDefinitions[sectionType];
		if (!definition.generation.allowed) {
			disallowedReasonByType[sectionType] = 'Section is disabled by generation policy.';
			continue;
		}

		const disallowedReason = evaluateMediaRequirement(definition, input);
		if (disallowedReason) {
			disallowedReasonByType[sectionType] = disallowedReason;
			continue;
		}

		allowedSectionTypes.push(sectionType);
	}

	for (const requiredType of requiredSectionTypes) {
		if (!allowedSectionTypes.includes(requiredType)) {
			throw new Error(`Required section type is not eligible: ${requiredType}`);
		}
	}

	return {
		allowedSectionTypes,
		requiredSectionTypes,
		disallowedReasonByType
	};
}
