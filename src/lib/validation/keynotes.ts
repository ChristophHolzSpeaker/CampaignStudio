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

export const keynoteFormSchema = z.object({
	keynoteTitle: z.string().trim().min(1, 'Keynote title is required.'),
	keynoteSummary: z.string().trim().min(24, 'Keynote summary should be descriptive.'),
	imageAlt: z.string().trim().min(1, 'Image alt text is required.'),
	audiences: csvTagsSchema,
	topics: csvTagsSchema,
	formats: csvTagsSchema,
	geographies: csvTagsSchema,
	intentTags: csvTagsSchema,
	priority: z.coerce.number().int().min(1).max(999)
});

export type KeynoteFormInput = z.infer<typeof keynoteFormSchema>;
