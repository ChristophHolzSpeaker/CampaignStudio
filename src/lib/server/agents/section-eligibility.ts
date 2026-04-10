import { pageSectionTypes, type PageSectionType } from '$lib/page-builder/sections';
import type { LandingPageGenerationInput } from './schemas/landing-page-input';

export type SectionEligibility = {
	allowedSectionTypes: PageSectionType[];
	requiredSectionTypes: PageSectionType[];
	disallowedReasonByType: Partial<Record<PageSectionType, string>>;
};

const requiredSectionTypes: PageSectionType[] = ['seo', 'compliance_transparency_footer'];

export function getSectionEligibility(input: LandingPageGenerationInput): SectionEligibility {
	const allowedSectionTypes: PageSectionType[] = [];
	const disallowedReasonByType: Partial<Record<PageSectionType, string>> = {};

	for (const sectionType of pageSectionTypes) {
		switch (sectionType) {
			case 'seo':
			case 'hybrid_content_section':
			case 'frictionless_funnel_booking':
			case 'compliance_transparency_footer':
				allowedSectionTypes.push(sectionType);
				break;
			case 'immediate_authority_hero':
				if (
					input.assets.heroDefaults.videoEmbedUrl &&
					input.assets.heroDefaults.videoThumbnailUrl
				) {
					allowedSectionTypes.push(sectionType);
				} else {
					disallowedReasonByType[sectionType] = 'Hero media defaults are missing.';
				}
				break;
			case 'logos_of_trust_ribbon':
				if (input.assets.fixedLogosRibbon.logos.length > 0) {
					allowedSectionTypes.push(sectionType);
				} else {
					disallowedReasonByType[sectionType] = 'No trust logos are configured.';
				}
				break;
			case 'proof_of_performance':
				if (input.assets.fixedProofOfPerformance.testimonials.length > 0) {
					allowedSectionTypes.push(sectionType);
				} else {
					disallowedReasonByType[sectionType] = 'No proof testimonials are configured.';
				}
				break;
		}
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
