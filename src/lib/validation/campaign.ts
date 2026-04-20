import { z } from 'zod';

const requiredFreeformField = (label: string) =>
	z
		.string()
		.trim()
		.min(2, `${label} must be at least 2 characters`)
		.max(120, `${label} must be 120 characters or fewer`);

export const campaignFormSchema = z.object({
	name: requiredFreeformField('Campaign name'),
	audience: requiredFreeformField('Audience'),
	format: requiredFreeformField('Format'),
	topic: requiredFreeformField('Topic'),
	language: requiredFreeformField('Language'),
	geography: requiredFreeformField('Geography'),
	notes: z.string().trim().max(2000, 'Notes must be 2000 characters or fewer').optional()
});

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;
export type CampaignFormSubmission = {
	name: string;
	audience: string;
	format: string;
	topic: string;
	language: string;
	geography: string;
	notes: string;
};
