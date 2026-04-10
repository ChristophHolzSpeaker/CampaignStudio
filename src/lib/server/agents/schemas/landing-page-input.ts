import { z } from 'zod';
import { landingPageAssetsSchema } from './landing-page-assets';

const landingPageInputKeywordSchema = z.object({
	keywordText: z.string(),
	matchType: z.string(),
	isNegative: z.boolean(),
	rationale: z.string().nullable().optional()
});

const landingPageInputAdSchema = z.object({
	headlines: z.array(z.string()).min(1),
	descriptions: z.array(z.string()).min(1),
	path1: z.string().nullable().optional(),
	path2: z.string().nullable().optional()
});

export const landingPageGenerationInputSchema = z.object({
	campaign: z.object({
		id: z.number().int().positive(),
		name: z.string(),
		audience: z.string(),
		format: z.string(),
		topic: z.string(),
		language: z.string(),
		geography: z.string(),
		notes: z.string().nullable()
	}),
	adPackage: z.object({
		id: z.number().int().positive(),
		targetingSummary: z.string(),
		messagingAngle: z.string(),
		conversionGoal: z.string()
	}),
	adGroup: z.object({
		id: z.number().int().positive(),
		name: z.string(),
		intentSummary: z.string(),
		landingPageAngle: z.string().nullable().optional(),
		keywords: z.array(landingPageInputKeywordSchema),
		ads: z.array(landingPageInputAdSchema)
	}),
	assets: landingPageAssetsSchema
});

export type LandingPageGenerationInput = z.infer<typeof landingPageGenerationInputSchema>;
