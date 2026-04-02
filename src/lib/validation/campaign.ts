import { z } from 'zod';

export const audienceOptions = ['IT Companies', 'Banks', 'Associations'] as const;
export const formatOptions = [
	'Morning Keynote',
	'Endnote',
	'Business Breakfast',
	'Panel Moderation',
	'Dinner Speech'
] as const;

export const campaignFormSchema = z.object({
	name: z.string().trim().min(2),
	audience: z.enum(audienceOptions),
	format: z.enum(formatOptions),
	topic: z.string().trim().min(2),
	notes: z.string().trim().optional()
});

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;
export type AudienceOption = (typeof audienceOptions)[number];
export type FormatOption = (typeof formatOptions)[number];
export type CampaignFormSubmission = {
	name: string;
	audience: string;
	format: string;
	topic: string;
	notes: string;
};
