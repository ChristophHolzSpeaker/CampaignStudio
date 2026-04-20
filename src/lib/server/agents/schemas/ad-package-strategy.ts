import { z } from 'zod';

export const adPackageStrategySchema = z.object({
	targetingSummary: z.string().trim().min(1),
	messagingAngle: z.string().trim().min(1),
	conversionGoal: z.string().trim().min(1),
	notes: z.array(z.string().trim().min(1)).optional()
});

export type AdPackageStrategy = z.infer<typeof adPackageStrategySchema>;
