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

const campaignIntentBriefSchema = z.object({
	audience: z.string(),
	problemStatement: z.string(),
	promise: z.string(),
	offer: z.string(),
	proofPoints: z.array(z.string()),
	ctaObjective: z.string(),
	tone: z.string(),
	constraints: z.array(z.string())
});

const landingMessageMapSchema = z.object({
	primaryAudience: z.string(),
	primaryPain: z.string(),
	primaryOutcome: z.string(),
	proofAnchors: z.array(z.string()),
	ctaIntent: z.string(),
	bannedGenericPhrases: z.array(z.string())
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
	campaignIntentBrief: campaignIntentBriefSchema,
	messageMap: landingMessageMapSchema,
	assets: landingPageAssetsSchema
});

export type LandingPageGenerationInput = z.infer<typeof landingPageGenerationInputSchema>;
