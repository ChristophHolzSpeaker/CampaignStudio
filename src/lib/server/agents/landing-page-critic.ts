import type { LandingPageDocument } from '$lib/page-builder/page';
import type { LandingPageArchitecture, LandingCritique } from './artifacts/landing-artifacts';

export function critiqueLandingPageDocument(
	page: LandingPageDocument,
	architecture: LandingPageArchitecture
): LandingCritique {
	const sectionTypes = page.sections.map((section) => section.type);
	const strengths: string[] = [];
	const warnings: string[] = [];
	const revisionSuggestions: string[] = [];

	if (sectionTypes.includes('seo')) {
		strengths.push('SEO metadata section is present.');
	}

	if (sectionTypes.includes('compliance_transparency_footer')) {
		strengths.push('Compliance footer is present.');
	}

	if (sectionTypes.length < architecture.sectionOrder.length) {
		warnings.push('Final section count is lower than planned architecture section count.');
		revisionSuggestions.push('Review missing planned sections before publish.');
	}

	if (!sectionTypes.includes('frictionless_funnel_booking')) {
		warnings.push('Primary booking CTA section is missing.');
		revisionSuggestions.push('Add a stronger, explicit booking CTA section.');
	}

	if (revisionSuggestions.length === 0) {
		revisionSuggestions.push('No immediate revisions required.');
	}

	return {
		strengths,
		warnings,
		revisionSuggestions
	};
}
