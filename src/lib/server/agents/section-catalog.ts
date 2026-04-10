import { sectionSpecs } from '$lib/page-builder/sections';
import type { PageSectionType } from '$lib/page-builder/sections';
import type { ZodTypeAny } from 'zod';

export type SectionCatalogItem = {
	type: PageSectionType;
	label: string;
	description: string;
	whenToUse: string[];
	whenNotToUse: string[];
	contentGuidance: string[];
	requiredTopLevelProps: string[];
};

function inferRequiredTopLevelProps(schema: ZodTypeAny): string[] {
	const emptyObjectAttempt = schema.safeParse({});
	if (emptyObjectAttempt.success) {
		return [];
	}

	const requiredKeys = new Set<string>();
	for (const issue of emptyObjectAttempt.error.issues) {
		if (issue.path.length === 1 && typeof issue.path[0] === 'string') {
			requiredKeys.add(issue.path[0]);
		}
	}

	return [...requiredKeys].sort();
}

export function buildSectionCatalog(
	allowedSectionTypes: readonly PageSectionType[]
): SectionCatalogItem[] {
	return allowedSectionTypes.map((sectionType) => {
		const spec = sectionSpecs[sectionType];
		return {
			type: spec.type,
			label: spec.label,
			description: spec.description,
			whenToUse: spec.whenToUse,
			whenNotToUse: spec.whenNotToUse,
			contentGuidance: spec.contentGuidance,
			requiredTopLevelProps: inferRequiredTopLevelProps(spec.propsSchema)
		};
	});
}
