import { z } from 'zod';

export const keynoteFormSchema = z.object({
	keynoteTitle: z.string().trim().min(1, 'Keynote title is required.'),
	keynoteSummary: z.string().trim().min(24, 'Keynote summary should be descriptive.'),
	imageAlt: z.string().trim().min(1, 'Image alt text is required.')
});

export type KeynoteFormInput = z.infer<typeof keynoteFormSchema>;
