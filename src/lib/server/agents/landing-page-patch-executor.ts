import type { LandingPageDocument } from '$lib/page-builder/page';
import type { PageSection } from '$lib/page-builder/sections';
import type { LandingPageOperation } from './landing-page-operations';

function findSectionIndex(sections: PageSection[], sectionType: string): number {
	return sections.findIndex((section) => section.type === sectionType);
}

function applyContentPatch(section: PageSection, patch: Record<string, unknown>): PageSection {
	return {
		...section,
		props: {
			...section.props,
			...patch
		}
	} as PageSection;
}

function applyLayoutPatch(section: PageSection, patch: Record<string, unknown>): PageSection {
	return {
		...section,
		props: {
			...section.props,
			...patch
		}
	} as PageSection;
}

function applyReplaceMediaField(section: PageSection, field: string, value: unknown): PageSection {
	if (!field.includes('.')) {
		return {
			...section,
			props: {
				...section.props,
				[field]: value
			}
		} as PageSection;
	}

	const fieldPath = field.split('.').filter((token) => token.length > 0);
	if (fieldPath.length === 0) {
		return section;
	}

	const root = structuredClone(section.props) as unknown as Record<string, unknown>;
	let cursor: Record<string, unknown> = root;
	for (let index = 0; index < fieldPath.length - 1; index += 1) {
		const key = fieldPath[index];
		const next = cursor[key];
		if (typeof next === 'object' && next !== null && !Array.isArray(next)) {
			cursor = next as Record<string, unknown>;
			continue;
		}

		const created: Record<string, unknown> = {};
		cursor[key] = created;
		cursor = created;
	}

	const leafKey = fieldPath[fieldPath.length - 1];
	cursor[leafKey] = value;

	return {
		...section,
		props: root
	} as unknown as PageSection;
}

function reorderSections(
	sections: PageSection[],
	sectionType: string,
	moveBeforeSectionType?: string,
	moveAfterSectionType?: string
): PageSection[] {
	const sourceIndex = findSectionIndex(sections, sectionType);
	if (sourceIndex < 0) {
		throw new Error(`Cannot reorder missing section type: ${sectionType}`);
	}

	const nextSections = [...sections];
	const [sourceSection] = nextSections.splice(sourceIndex, 1);
	if (!sourceSection) {
		throw new Error(`Failed to resolve section for reorder: ${sectionType}`);
	}

	if (moveBeforeSectionType) {
		const targetIndex = findSectionIndex(nextSections, moveBeforeSectionType);
		if (targetIndex < 0) {
			throw new Error(`Cannot move before missing section type: ${moveBeforeSectionType}`);
		}

		nextSections.splice(targetIndex, 0, sourceSection);
		return nextSections;
	}

	if (moveAfterSectionType) {
		const targetIndex = findSectionIndex(nextSections, moveAfterSectionType);
		if (targetIndex < 0) {
			throw new Error(`Cannot move after missing section type: ${moveAfterSectionType}`);
		}

		nextSections.splice(targetIndex + 1, 0, sourceSection);
		return nextSections;
	}

	return sections;
}

export function applyLandingPageOperations(
	page: LandingPageDocument,
	operations: LandingPageOperation[]
): LandingPageDocument {
	let nextSections = [...page.sections];

	for (const operation of operations) {
		if (operation.type === 'reorder_section') {
			nextSections = reorderSections(
				nextSections,
				operation.sectionType,
				operation.moveBeforeSectionType,
				operation.moveAfterSectionType
			);
			continue;
		}

		const sectionIndex = findSectionIndex(nextSections, operation.sectionType);
		if (sectionIndex < 0) {
			throw new Error(`Operation references missing section type: ${operation.sectionType}`);
		}

		const currentSection = nextSections[sectionIndex];
		if (!currentSection) {
			throw new Error(`Operation failed to resolve section type: ${operation.sectionType}`);
		}

		if (operation.type === 'update_section_content') {
			nextSections[sectionIndex] = applyContentPatch(currentSection, operation.contentPatch);
			continue;
		}

		if (operation.type === 'update_section_layout') {
			nextSections[sectionIndex] = applyLayoutPatch(currentSection, operation.layoutPatch);
			continue;
		}

		nextSections[sectionIndex] = applyReplaceMediaField(
			currentSection,
			operation.field,
			operation.value
		);
	}

	return {
		...page,
		sections: nextSections
	};
}
