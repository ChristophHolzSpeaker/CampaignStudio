import { z } from 'zod';

const campaignPlannerFieldSchema = z.object({
	name: z.string().optional(),
	audience: z.string().optional(),
	format: z.string().optional(),
	topic: z.string().optional(),
	language: z.string().optional(),
	geography: z.string().optional(),
	notes: z.string().optional()
});

const plannerMessageSchema = z.object({
	role: z.enum(['user', 'assistant']),
	content: z.string().min(1)
});

export const campaignPlannerOutputSchema = z.object({
	planMarkdown: z.string().min(1),
	resolvedFields: campaignPlannerFieldSchema,
	missingFields: z.array(z.enum(['name', 'audience', 'format', 'topic', 'language', 'geography'])),
	questions: z.array(z.string().min(1)),
	readyToCreate: z.boolean()
});

export const campaignPlannerInputSchema = z.object({
	conversation: z.array(plannerMessageSchema).min(1),
	latestUserMessage: z.string().min(1),
	resolvedFields: campaignPlannerFieldSchema
});

export type CampaignPlannerInput = z.infer<typeof campaignPlannerInputSchema>;
export type CampaignPlannerOutput = z.infer<typeof campaignPlannerOutputSchema>;
