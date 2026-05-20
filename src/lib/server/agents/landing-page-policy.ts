import type { LandingPageDocument } from '$lib/page-builder/page';
import type { PageSectionType } from '$lib/page-builder/sections';
import { resolvePageCapabilities } from './section-definitions';

export function collectLandingPageDocumentMvpIssues(
	page: LandingPageDocument,
	allowedSectionTypes: readonly PageSectionType[],
	requiredSectionTypes: readonly PageSectionType[]
): string[] {
	const minSections = requiredSectionTypes.length;
	const issues: string[] = [];

	if (page.sections.length < minSections) {
		issues.push(`Landing page must include at least ${minSections} sections for this MVP.`);
	}

	const allowedTypes = new Set<string>(allowedSectionTypes);
	const sectionTypes = page.sections.map((section) => section.type);
	for (const sectionType of sectionTypes) {
		if (!allowedTypes.has(sectionType)) {
			issues.push(`Unsupported section type for MVP landing page: ${sectionType}`);
		}
	}

	for (const requiredSectionType of requiredSectionTypes) {
		if (!sectionTypes.includes(requiredSectionType)) {
			issues.push(`Landing page must include ${requiredSectionType} section.`);
		}
	}

	const capabilityResolution = resolvePageCapabilities(page);
	for (const missingCapability of capabilityResolution.missingRequiredCapabilities) {
		issues.push(`Landing page is missing required capability: ${missingCapability}`);
	}

	return issues;
}

export function validateLandingPageDocumentForMvp(
	page: LandingPageDocument,
	allowedSectionTypes: readonly PageSectionType[],
	requiredSectionTypes: readonly PageSectionType[]
): void {
	const issues = collectLandingPageDocumentMvpIssues(
		page,
		allowedSectionTypes,
		requiredSectionTypes
	);

	if (issues.length > 0) {
		throw new Error(issues.join(' | '));
	}
}
