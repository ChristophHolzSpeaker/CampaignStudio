import type { LandingPageDocument } from '$lib/page-builder/page';
import { sectionSpecs } from '$lib/page-builder/sections/specs';
import {
	pageSectionTypes,
	type PageSectionSpec,
	type PageSectionType
} from '$lib/page-builder/sections/types';

export type LandingPageCapability =
	| 'seo_metadata'
	| 'hero_authority'
	| 'logo_proof'
	| 'video_proof'
	| 'keynote_offers'
	| 'audience_outcomes'
	| 'booking_cta'
	| 'testimonial_proof'
	| 'booklet_cta'
	| 'compliance';

export type SectionDefinition = {
	type: PageSectionType;
	displayName: string;
	capabilities: LandingPageCapability[];
	schema: PageSectionSpec['propsSchema'];
	generation: {
		allowed: boolean;
		requiredForCapabilities?: LandingPageCapability[];
		preferredNarrativeOrder?: number;
	};
	editing: {
		mustPreserveSingleton?: boolean;
	};
	media: {
		requirement:
			| 'none'
			| 'hero_defaults'
			| 'logos_any'
			| 'keynotes_min_3'
			| 'speaker_videos_min_4'
			| 'proof_testimonials_any';
	};
};

const baseDefinitions: Record<PageSectionType, Omit<SectionDefinition, 'schema'>> = {
	seo: {
		type: 'seo',
		displayName: 'SEO Metadata',
		capabilities: ['seo_metadata'],
		generation: {
			allowed: true,
			requiredForCapabilities: ['seo_metadata'],
			preferredNarrativeOrder: 1
		},
		editing: { mustPreserveSingleton: true },
		media: { requirement: 'none' }
	},
	immediate_authority_hero: {
		type: 'immediate_authority_hero',
		displayName: 'Immediate Authority Hero',
		capabilities: ['hero_authority'],
		generation: {
			allowed: true,
			requiredForCapabilities: ['hero_authority'],
			preferredNarrativeOrder: 2
		},
		editing: {},
		media: { requirement: 'hero_defaults' }
	},
	hero_large_email_cta: {
		type: 'hero_large_email_cta',
		displayName: 'Hero Large Email CTA',
		capabilities: ['booking_cta'],
		generation: { allowed: true },
		editing: {},
		media: { requirement: 'none' }
	},
	booklet_download_cta: {
		type: 'booklet_download_cta',
		displayName: 'Booklet Download CTA',
		capabilities: ['booklet_cta'],
		generation: {
			allowed: true,
			requiredForCapabilities: ['booklet_cta'],
			preferredNarrativeOrder: 9
		},
		editing: {},
		media: { requirement: 'none' }
	},
	logos_of_trust_ribbon: {
		type: 'logos_of_trust_ribbon',
		displayName: 'Logos of Trust Ribbon',
		capabilities: ['logo_proof'],
		generation: {
			allowed: true,
			requiredForCapabilities: ['logo_proof'],
			preferredNarrativeOrder: 5
		},
		editing: {},
		media: { requirement: 'logos_any' }
	},
	youtube_grid: {
		type: 'youtube_grid',
		displayName: 'YouTube Grid',
		capabilities: ['video_proof'],
		generation: {
			allowed: true,
			requiredForCapabilities: ['video_proof'],
			preferredNarrativeOrder: 3
		},
		editing: {},
		media: { requirement: 'speaker_videos_min_4' }
	},
	keynote_speeches: {
		type: 'keynote_speeches',
		displayName: 'Keynote Speeches',
		capabilities: ['keynote_offers'],
		generation: {
			allowed: true,
			requiredForCapabilities: ['keynote_offers'],
			preferredNarrativeOrder: 4
		},
		editing: {},
		media: { requirement: 'keynotes_min_3' }
	},
	speaker_in_action: {
		type: 'speaker_in_action',
		displayName: 'Speaker in Action',
		capabilities: ['video_proof'],
		generation: { allowed: true },
		editing: {},
		media: { requirement: 'speaker_videos_min_4' }
	},
	hybrid_content_section: {
		type: 'hybrid_content_section',
		displayName: 'Hybrid Content Section',
		capabilities: ['audience_outcomes'],
		generation: {
			allowed: true,
			requiredForCapabilities: ['audience_outcomes'],
			preferredNarrativeOrder: 6
		},
		editing: {},
		media: { requirement: 'none' }
	},
	proof_of_performance: {
		type: 'proof_of_performance',
		displayName: 'Proof of Performance',
		capabilities: ['testimonial_proof'],
		generation: {
			allowed: true,
			requiredForCapabilities: ['testimonial_proof'],
			preferredNarrativeOrder: 8
		},
		editing: {},
		media: { requirement: 'proof_testimonials_any' }
	},
	frictionless_funnel_booking: {
		type: 'frictionless_funnel_booking',
		displayName: 'Frictionless Funnel Booking',
		capabilities: ['booking_cta'],
		generation: {
			allowed: true,
			requiredForCapabilities: ['booking_cta'],
			preferredNarrativeOrder: 7
		},
		editing: {},
		media: { requirement: 'none' }
	},
	compliance_transparency_footer: {
		type: 'compliance_transparency_footer',
		displayName: 'Compliance Transparency Footer',
		capabilities: ['compliance'],
		generation: {
			allowed: true,
			requiredForCapabilities: ['compliance'],
			preferredNarrativeOrder: 10
		},
		editing: { mustPreserveSingleton: true },
		media: { requirement: 'none' }
	}
};

export const requiredMvpCapabilities: readonly LandingPageCapability[] = [
	'seo_metadata',
	'hero_authority',
	'video_proof',
	'keynote_offers',
	'logo_proof',
	'audience_outcomes',
	'booking_cta',
	'testimonial_proof',
	'booklet_cta',
	'compliance'
];

export const sectionDefinitions: Record<PageSectionType, SectionDefinition> = Object.fromEntries(
	pageSectionTypes.map((type) => {
		const base = baseDefinitions[type];
		const spec = sectionSpecs[type];
		return [type, { ...base, schema: spec.propsSchema }];
	})
) as Record<PageSectionType, SectionDefinition>;

export function resolveRequiredSectionTypes(
	requiredCapabilities: readonly LandingPageCapability[] = requiredMvpCapabilities
): PageSectionType[] {
	const resolved: PageSectionType[] = [];
	for (const capability of requiredCapabilities) {
		const definition = pageSectionTypes
			.map((type) => sectionDefinitions[type])
			.find((candidate) => candidate.generation.requiredForCapabilities?.includes(capability));

		if (!definition) {
			throw new Error(`No section definition is mapped to required capability: ${capability}`);
		}

		if (!resolved.includes(definition.type)) {
			resolved.push(definition.type);
		}
	}

	return resolved;
}

export function resolvePreferredSectionOrder(
	sectionTypes: readonly PageSectionType[]
): PageSectionType[] {
	return [...sectionTypes].sort((left, right) => {
		const leftOrder =
			sectionDefinitions[left].generation.preferredNarrativeOrder ?? Number.MAX_SAFE_INTEGER;
		const rightOrder =
			sectionDefinitions[right].generation.preferredNarrativeOrder ?? Number.MAX_SAFE_INTEGER;
		return leftOrder - rightOrder;
	});
}

export function resolveEditorRequiredSectionTypes(): PageSectionType[] {
	return pageSectionTypes.filter((type) => sectionDefinitions[type].editing.mustPreserveSingleton);
}

export function resolvePageCapabilities(page: LandingPageDocument): {
	presentCapabilities: LandingPageCapability[];
	missingRequiredCapabilities: LandingPageCapability[];
} {
	const present = new Set<LandingPageCapability>();
	for (const section of page.sections) {
		const definition = sectionDefinitions[section.type];
		for (const capability of definition.capabilities) {
			present.add(capability);
		}
	}

	const presentCapabilities = [...present];
	const missingRequiredCapabilities = requiredMvpCapabilities.filter(
		(capability) => !present.has(capability)
	);

	return {
		presentCapabilities,
		missingRequiredCapabilities
	};
}
