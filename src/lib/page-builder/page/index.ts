import { landingPageDocumentSchema } from './schema';

export { landingPageDocumentSchema, type LandingPageDocumentSchemaType } from './schema';
export { christophSampleLandingPage } from './sample';
export { type LandingPageDocument } from './types';

function normalizeLegacyHybridPrimaryVisual(input: unknown): unknown {
	if (typeof input !== 'object' || input === null) {
		return input;
	}

	const candidate = input as { sections?: unknown[] };
	if (!Array.isArray(candidate.sections)) {
		return input;
	}

	const normalizedSections = candidate.sections.map((section) => {
		if (typeof section !== 'object' || section === null) {
			return section;
		}

		const sectionRecord = section as { type?: unknown; props?: unknown };
		if (sectionRecord.type !== 'hybrid_content_section') {
			return section;
		}

		if (typeof sectionRecord.props !== 'object' || sectionRecord.props === null) {
			return section;
		}

		const props = sectionRecord.props as {
			primaryVisual?: unknown;
			supportingVisualItems?: unknown;
		};

		if (props.primaryVisual != null) {
			return section;
		}

		const legacyItems = Array.isArray(props.supportingVisualItems)
			? props.supportingVisualItems
			: [];
		const [firstLegacyVisual] = legacyItems;
		if (typeof firstLegacyVisual !== 'object' || firstLegacyVisual === null) {
			return section;
		}

		const legacyVisual = firstLegacyVisual as {
			imageUrl?: unknown;
			alt?: unknown;
			caption?: unknown;
		};

		if (typeof legacyVisual.imageUrl !== 'string' || typeof legacyVisual.alt !== 'string') {
			return section;
		}

		return {
			...sectionRecord,
			props: {
				...props,
				primaryVisual: {
					imageUrl: legacyVisual.imageUrl,
					alt: legacyVisual.alt,
					caption: typeof legacyVisual.caption === 'string' ? legacyVisual.caption : undefined
				}
			}
		};
	});

	return {
		...candidate,
		sections: normalizedSections
	};
}

export function parseLandingPageDocument(input: unknown) {
	return landingPageDocumentSchema.parse(normalizeLegacyHybridPrimaryVisual(input));
}

export function safeParseLandingPageDocument(input: unknown) {
	return landingPageDocumentSchema.safeParse(normalizeLegacyHybridPrimaryVisual(input));
}
