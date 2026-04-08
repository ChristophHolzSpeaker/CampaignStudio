import { z } from 'zod';
import { pageSectionsSchema } from '$lib/page-builder/sections';

export const landingPageDocumentSchema = z.object({
	version: z.literal(1),
	title: z.string().trim().min(1),
	slug: z.string().trim().min(1).optional(),
	sections: pageSectionsSchema
});

export type LandingPageDocumentSchemaType = z.infer<typeof landingPageDocumentSchema>;
