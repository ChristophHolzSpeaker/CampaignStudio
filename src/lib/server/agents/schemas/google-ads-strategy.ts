import { z } from 'zod';

const googleAdsStrategyAdGroup = z.object({
	name: z.string(),
	intentSummary: z.string(),
	landingPageAngle: z.string(),
	keywordThemes: z.array(z.string()).min(1),
	negativeKeywordThemes: z.array(z.string()).min(0),
	adConcept: z.string()
});

export const googleAdsStrategySchema = z.object({
	packageName: z.string(),
	channel: z.literal('google_ads_search'),
	targetingSummary: z.string(),
	messagingAngle: z.string(),
	conversionGoal: z.string(),
	adGroups: z.array(googleAdsStrategyAdGroup).min(2).max(5)
});

export type GoogleAdsStrategy = z.infer<typeof googleAdsStrategySchema>;
export type GoogleAdsStrategyAdGroup = z.infer<typeof googleAdsStrategyAdGroup>;
