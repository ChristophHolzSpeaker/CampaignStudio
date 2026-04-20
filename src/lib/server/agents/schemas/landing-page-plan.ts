import { z } from 'zod';

const landingPagePlanSectionSchema = z.object({
	type: z.string().trim().min(1),
	purpose: z.string().trim().min(1),
	contentDirection: z.string().trim().min(1)
});

const heroAssetSelectionSchema = z.object({
	videoAssetId: z.string().trim().min(1),
	rationale: z.string().trim().min(1)
});

const hybridAssetSelectionSchema = z.object({
	supportingImageAssetIds: z.array(z.string().trim().min(1)).max(3),
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
				hybridContentSection: hybridAssetSelectionSchema.optional()
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

			return Boolean(plan.assetPlan?.hero?.videoAssetId);
		},
		{
			message:
				'assetPlan.hero.videoAssetId is required when immediate_authority_hero is included in sectionPlan.',
			path: ['assetPlan', 'hero', 'videoAssetId']
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

	if (sectionTypes[0] !== 'seo') {
		throw new Error('Strategist plan must place seo as the first section.');
	}
}

export type LandingPagePlan = z.infer<typeof landingPagePlanSchema>;
