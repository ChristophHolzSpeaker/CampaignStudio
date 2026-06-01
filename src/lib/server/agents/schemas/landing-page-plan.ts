import { z } from 'zod';
import {
	requiredMvpCapabilities,
	sectionDefinitions,
	type LandingPageCapability
} from '../section-definitions';

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
	primaryImageAssetId: z.string().trim().min(1),
	rationale: z.string().trim().min(1)
});

const speakerInActionAssetSelectionSchema = z
	.object({
		videoAssetIds: z.array(z.string().trim().min(1)).min(3).max(3),
		rationale: z.string().trim().min(1)
	})
	.refine((selection) => new Set(selection.videoAssetIds).size === selection.videoAssetIds.length, {
		message: 'assetPlan.speakerInAction.videoAssetIds must contain unique IDs.',
		path: ['videoAssetIds']
	});

const logosOfTrustRibbonSelectionSchema = z.object({
	rationale: z.string().trim().min(1)
});

const keynoteSpeechesSelectionSchema = z.object({
	keynoteIds: z.array(z.string().trim().min(1)).min(3).max(3),
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
				logosOfTrustRibbon: logosOfTrustRibbonSelectionSchema.optional(),
				keynoteSpeeches: keynoteSpeechesSelectionSchema.optional()
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
			if (!sectionTypes.has('keynote_speeches')) {
				return true;
			}

			return Boolean(plan.assetPlan?.keynoteSpeeches);
		},
		{
			message:
				'assetPlan.keynoteSpeeches is required when keynote_speeches is included in sectionPlan.',
			path: ['assetPlan', 'keynoteSpeeches']
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
			if (!sectionTypes.has('youtube_grid')) {
				return true;
			}

			return Boolean(plan.assetPlan?.speakerInAction);
		},
		{
			message:
				'assetPlan.speakerInAction is required when youtube_grid is included in sectionPlan.',
			path: ['assetPlan', 'speakerInAction']
		}
	);

export function validateLandingPagePlanSections(
	plan: LandingPagePlan,
	allowedSectionTypes: readonly string[],
	requiredSectionTypes: readonly string[],
	requiredCapabilities: readonly LandingPageCapability[] = requiredMvpCapabilities
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

	const capabilitySet = new Set<LandingPageCapability>();
	for (const sectionType of sectionTypes) {
		const definition = sectionDefinitions[sectionType as keyof typeof sectionDefinitions];
		if (!definition) {
			continue;
		}
		for (const capability of definition.capabilities) {
			capabilitySet.add(capability);
		}
	}

	for (const requiredCapability of requiredCapabilities) {
		if (!capabilitySet.has(requiredCapability)) {
			throw new Error(`Strategist plan is missing required capability: ${requiredCapability}`);
		}
	}
}

export type LandingPagePlan = z.infer<typeof landingPagePlanSchema>;
