import { z } from 'zod';

const csvTagsSchema = z
	.string()
	.trim()
	.transform((value) =>
		value
			.split(',')
			.map((part) => part.trim())
			.filter((part) => part.length > 0)
	);

export const clientFormSchema = z.object({
	name: z.string().trim().min(1, 'Client name is required.'),
	logoAlt: z.string().trim().min(1, 'Logo alt text is required.'),
	industry: z.string().trim().min(1, 'Industry is required.'),
	keynoteCaseStudy: z.string().trim().min(24, 'Case study should be descriptive.'),
	audiences: csvTagsSchema,
	topics: csvTagsSchema,
	formats: csvTagsSchema,
	geographies: csvTagsSchema,
	intentTags: csvTagsSchema,
	priority: z.coerce.number().int().min(1).max(999)
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;
