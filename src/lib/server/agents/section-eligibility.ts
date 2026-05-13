import { pageSectionTypes, type PageSectionType } from '$lib/page-builder/sections';
import type { LandingPageGenerationInput } from './schemas/landing-page-input';

export type SectionEligibility = {
	allowedSectionTypes: PageSectionType[];
	requiredSectionTypes: PageSectionType[];
	disallowedReasonByType: Partial<Record<PageSectionType, string>>;
};

const requiredSectionTypes: PageSectionType[] = [
	'seo',
	'immediate_authority_hero',
	'logos_of_trust_ribbon',
	'keynote_speeches',
	'hybrid_content_section',
	'speaker_in_action',
	'frictionless_funnel_booking',
	'proof_of_performance',
	'booklet_download_cta',
	'compliance_transparency_footer'
];

export function getSectionEligibility(input: LandingPageGenerationInput): SectionEligibility {
	const allowedSectionTypes: PageSectionType[] = [];
	const disallowedReasonByType: Partial<Record<PageSectionType, string>> = {};

	for (const sectionType of pageSectionTypes) {
		switch (sectionType) {
			case 'seo':
			case 'booklet_download_cta':
			case 'hybrid_content_section':
			case 'frictionless_funnel_booking':
			case 'compliance_transparency_footer':
				allowedSectionTypes.push(sectionType);
				break;
			case 'immediate_authority_hero':
				if (
					input.assets.heroDefaults.videoEmbedUrl &&
					(input.assets.heroDefaults.heroImageUrl || input.assets.heroDefaults.videoThumbnailUrl)
				) {
					allowedSectionTypes.push(sectionType);
				} else {
					disallowedReasonByType[sectionType] =
						'Hero media defaults are missing (video + hero image).';
				}
				break;
			case 'logos_of_trust_ribbon':
				if (
					input.assets.assetCatalog.logoCatalog.length > 0 ||
					input.assets.fixedLogosRibbon.logos.length > 0
				) {
					allowedSectionTypes.push(sectionType);
				} else {
					disallowedReasonByType[sectionType] = 'No active logos or fallback logos are configured.';
				}
				break;
			case 'keynote_speeches':
				if (input.assets.assetCatalog.keynoteCatalog.length >= 3) {
					allowedSectionTypes.push(sectionType);
				} else {
					disallowedReasonByType[sectionType] =
						'At least 3 active keynotes are required in keynote catalog.';
				}
				break;
			case 'speaker_in_action':
				if (input.assets.assetCatalog.speakerInActionVideos.length >= 4) {
					allowedSectionTypes.push(sectionType);
				} else {
					disallowedReasonByType[sectionType] =
						'At least 4 speaker_in_action video assets are required.';
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
