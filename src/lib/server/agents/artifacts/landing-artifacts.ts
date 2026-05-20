import type { LandingPageDocument } from '$lib/page-builder/page';
import { z } from 'zod';
import type { LandingPageGenerationInput } from '../schemas/landing-page-input';
import type { LandingPagePlan } from '../schemas/landing-page-plan';

export const landingStrategySchema = z.object({
	positioning: z.string().trim().min(1),
	messagingAngle: z.string().trim().min(1),
	emotionalDirection: z.string().trim().min(1),
	ctaStrategy: z.string().trim().min(1)
});

export type LandingStrategy = z.infer<typeof landingStrategySchema>;

export const landingPageArchitectureSchema = z.object({
	pageTitle: z.string().trim().min(1),
	conversionGoal: z.string().trim().min(1),
	sectionOrder: z.array(z.string().trim().min(1)).min(1),
	sectionPacing: z.array(
		z.object({
			type: z.string().trim().min(1),
			purpose: z.string().trim().min(1)
		})
	)
});

export type LandingPageArchitecture = z.infer<typeof landingPageArchitectureSchema>;

export const landingMediaPlanSchema = z.object({
	hero: z
		.object({
			videoAssetId: z.string().trim().min(1),
			imageAssetId: z.string().trim().min(1),
			rationale: z.string().trim().min(1)
		})
		.optional(),
	hybridContentSection: z
		.object({
			primaryImageAssetId: z.string().trim().min(1),
			rationale: z.string().trim().min(1)
		})
		.optional(),
	speakerInAction: z
		.object({
			videoAssetIds: z.array(z.string().trim().min(1)),
			rationale: z.string().trim().min(1)
		})
		.optional(),
	keynoteSpeeches: z
		.object({
			keynoteIds: z.array(z.string().trim().min(1)),
			rationale: z.string().trim().min(1)
		})
		.optional(),
	logosOfTrustRibbon: z
		.object({
			rationale: z.string().trim().min(1)
		})
		.optional()
});

export type LandingMediaPlan = z.infer<typeof landingMediaPlanSchema>;

export const landingCritiqueSchema = z.object({
	strengths: z.array(z.string().trim().min(1)),
	warnings: z.array(z.string().trim().min(1)),
	revisionSuggestions: z.array(z.string().trim().min(1))
});

export type LandingCritique = z.infer<typeof landingCritiqueSchema>;

export function createLandingStrategy(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): LandingStrategy {
	return landingStrategySchema.parse({
		positioning: input.adPackage.messagingAngle || input.campaign.topic,
		messagingAngle: plan.messagingAngle,
		emotionalDirection: `Confident, practical, and audience-specific for ${input.campaign.audience}`,
		ctaStrategy: plan.conversionGoal
	});
}

export function createLandingPageArchitecture(plan: LandingPagePlan): LandingPageArchitecture {
	return landingPageArchitectureSchema.parse({
		pageTitle: plan.pageTitle,
		conversionGoal: plan.conversionGoal,
		sectionOrder: plan.sectionPlan.map((section) => section.type),
		sectionPacing: plan.sectionPlan.map((section) => ({
			type: section.type,
			purpose: section.purpose
		}))
	});
}

export function createLandingMediaPlan(plan: LandingPagePlan): LandingMediaPlan {
	return landingMediaPlanSchema.parse(plan.assetPlan ?? {});
}

export function validateLandingCritique(critique: LandingCritique): LandingCritique {
	return landingCritiqueSchema.parse(critique);
}

export function validateLandingPageArchitecture(
	architecture: LandingPageArchitecture
): LandingPageArchitecture {
	return landingPageArchitectureSchema.parse(architecture);
}

export function validateLandingMediaPlan(mediaPlan: LandingMediaPlan): LandingMediaPlan {
	return landingMediaPlanSchema.parse(mediaPlan);
}

export function validateLandingStrategy(strategy: LandingStrategy): LandingStrategy {
	return landingStrategySchema.parse(strategy);
}

export function summarizePageForCritique(page: LandingPageDocument): {
	sectionCount: number;
	sectionTypes: string[];
} {
	return {
		sectionCount: page.sections.length,
		sectionTypes: page.sections.map((section) => section.type)
	};
}
