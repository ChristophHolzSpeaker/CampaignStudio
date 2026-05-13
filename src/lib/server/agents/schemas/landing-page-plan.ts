import { z } from 'zod';

const REQUIRED_INITIAL_SECTION_ORDER = [
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
] as const;

const landingPagePlanSectionSchema = z.object({
	type: z.string().trim().min(1),
	purpose: z.string().trim().min(1),
	contentDirection: z.string().trim().min(1)
});

const heroAssetSelectionSchema = z.object({
	videoAssetId: z.string().trim().min(1),
	imageAssetId: z.string().trim().min(1),
	rationale: z.string().trim().min(1)
});

const hybridAssetSelectionSchema = z.object({
	supportingImageAssetIds: z.array(z.string().trim().min(1)).max(3),
	rationale: z.string().trim().min(1)
});

const speakerInActionAssetSelectionSchema = z.object({
	videoAssetIds: z.array(z.string().trim().min(1)).min(4).max(4),
	rationale: z.string().trim().min(1)
});

const logosOfTrustRibbonSelectionSchema = z.object({
	rationale: z.string().trim().min(1)
});

export const landingPagePlanSchema = z
	.object({
		pageTitle: z.string().trim().min(1),
		conversionGoal: z.string().trim().min(1),
		messagingAngle: z.string().trim().min(1),
		sectionPlan: z.array(landingPagePlanSectionSchema).min(2),
		assetPlan: z
			.object({
				hero: heroAssetSelectionSchema.optional(),
				hybridContentSection: hybridAssetSelectionSchema.optional(),
				speakerInAction: speakerInActionAssetSelectionSchema.optional(),
				logosOfTrustRibbon: logosOfTrustRibbonSelectionSchema.optional()
			})
			.optional()
	})
	.refine(
		(plan) => {
			const sectionTypes = plan.sectionPlan.map((section) => section.type);
			return sectionTypes.length === new Set(sectionTypes).size;
		},
		{
			message: 'sectionPlan must not contain duplicate section types.',
			path: ['sectionPlan']
		}
	)
	.refine(
		(plan) => {
			const sectionTypes = new Set(plan.sectionPlan.map((section) => section.type));
			if (!sectionTypes.has('immediate_authority_hero')) {
				return true;
			}

			return Boolean(plan.assetPlan?.hero?.videoAssetId && plan.assetPlan?.hero?.imageAssetId);
		},
		{
			message:
				'assetPlan.hero.videoAssetId and assetPlan.hero.imageAssetId are required when immediate_authority_hero is included in sectionPlan.',
			path: ['assetPlan', 'hero']
		}
	)
	.refine(
		(plan) => {
			const sectionTypes = new Set(plan.sectionPlan.map((section) => section.type));
			if (!sectionTypes.has('hybrid_content_section')) {
				return true;
			}

			return Boolean(plan.assetPlan?.hybridContentSection);
		},
		{
			message:
				'assetPlan.hybridContentSection is required when hybrid_content_section is included in sectionPlan.',
			path: ['assetPlan', 'hybridContentSection']
		}
	)
	.refine(
		(plan) => {
			const sectionTypes = new Set(plan.sectionPlan.map((section) => section.type));
			if (!sectionTypes.has('speaker_in_action')) {
				return true;
			}

			return Boolean(plan.assetPlan?.speakerInAction);
		},
		{
			message:
				'assetPlan.speakerInAction is required when speaker_in_action is included in sectionPlan.',
			path: ['assetPlan', 'speakerInAction']
		}
	);

export function validateLandingPagePlanSections(
	plan: LandingPagePlan,
	allowedSectionTypes: readonly string[],
	requiredSectionTypes: readonly string[]
): void {
	const allowedSet = new Set(allowedSectionTypes);
	const sectionTypes = plan.sectionPlan.map((section) => section.type);

	for (const sectionType of sectionTypes) {
		if (!allowedSet.has(sectionType)) {
			throw new Error(`Strategist used unsupported section type: ${sectionType}`);
		}
	}

	for (const requiredSectionType of requiredSectionTypes) {
		if (!sectionTypes.includes(requiredSectionType)) {
			throw new Error(`Strategist plan missing required section type: ${requiredSectionType}`);
		}
	}

	if (sectionTypes.length !== REQUIRED_INITIAL_SECTION_ORDER.length) {
		throw new Error(
			`Strategist plan must include exactly ${REQUIRED_INITIAL_SECTION_ORDER.length} sections in the required initial order.`
		);
	}

	for (let index = 0; index < REQUIRED_INITIAL_SECTION_ORDER.length; index += 1) {
		if (sectionTypes[index] !== REQUIRED_INITIAL_SECTION_ORDER[index]) {
			throw new Error(
				`Strategist plan must follow the required section order: ${REQUIRED_INITIAL_SECTION_ORDER.join(', ')}.`
			);
		}
	}
}

export type LandingPagePlan = z.infer<typeof landingPagePlanSchema>;
