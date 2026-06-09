import { z } from 'zod';

export const keynoteFormSchema = z.object({
	keynoteTitle: z.string().trim().min(1, 'Keynote title is required.'),
	imageAlt: z.string().trim().min(1, 'Image alt text is required.'),
	theme: z.string().trim(),
	audience: z.string().trim(),
	language: z.string().trim(),
	subtitle: z.string().trim(),
	moderation: z.string().trim(),
	keynoteLong: z.string().trim(),
	keynoteShort: z.string().trim().min(24, 'Keynote summary should be descriptive.'),
	speaker: z.string().trim()
});

export type KeynoteFormInput = z.infer<typeof keynoteFormSchema>;
