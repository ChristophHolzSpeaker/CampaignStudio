import { z } from 'zod';

const keywordSchema = z.object({
	keywordText: z.string(),
	matchType: z.enum(['broad', 'phrase', 'exact']),
	isNegative: z.boolean(),
	rationale: z.string(),
	position: z.number().int().nonnegative()
});

const adSchema = z.object({
	adType: z.literal('responsive_search_ad'),
	headlines: z.array(z.string()).min(1),
	descriptions: z.array(z.string()).min(1),
	path1: z.string().optional(),
	path2: z.string().optional()
});

const adGroupSchema = z.object({
	name: z.string(),
	intentSummary: z.string(),
	position: z.number().int().nonnegative(),
	campaignPageId: z.number().nullable(),
	keywords: z.array(keywordSchema).min(1),
	ads: z.array(adSchema).min(1)
});

export const googleAdsPackageDraftSchema = z.object({
	package: z.object({
		versionNumber: z.number().int().positive(),
		channel: z.literal('google_ads_search'),
		status: z.literal('draft'),
		strategyJson: z.object({
			targetingSummary: z.string(),
			messagingAngle: z.string(),
			conversionGoal: z.string(),
			notes: z.array(z.string()).optional()
		})
	}),
	adGroups: z.array(adGroupSchema).min(1).max(5)
});

export type GoogleAdsPackageDraft = z.infer<typeof googleAdsPackageDraftSchema>;
export type GoogleAdsPackageDraftAdGroup = z.infer<typeof adGroupSchema>;
export type GoogleAdsPackageDraftKeyword = z.infer<typeof keywordSchema>;
export type GoogleAdsPackageDraftAd = z.infer<typeof adSchema>;
