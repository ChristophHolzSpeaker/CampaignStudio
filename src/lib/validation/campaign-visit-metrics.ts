import { z } from 'zod';

export const campaignVisitMetricsSchema = z.object({
	campaignId: z.number().int().positive(),
	visitCount: z.number().int().nonnegative(),
	uniqueVisitorCount: z.number().int().nonnegative(),
	lastVisitedAt: z.date().nullable()
});

export type CampaignVisitMetrics = z.infer<typeof campaignVisitMetricsSchema>;
