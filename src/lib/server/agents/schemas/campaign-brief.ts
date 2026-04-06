import { z } from 'zod';

export const campaignBriefSchema = z.object({
	campaignId: z.number().int().positive(),
	name: z.string(),
	audience: z.string(),
	format: z.string(),
	topic: z.string(),
	language: z.string(),
	geography: z.string(),
	notes: z.string().nullable(),
	goal: z.literal('speaker_inquiry')
});

export type CampaignBrief = z.infer<typeof campaignBriefSchema>;
