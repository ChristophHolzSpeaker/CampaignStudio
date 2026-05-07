import { z } from 'zod';

export const logoFormSchema = z.object({
	name: z.string().trim().min(1, 'Client name is required.'),
	logoAlt: z.string().trim().min(1, 'Logo alt text is required.'),
	priority: z.coerce.number().int().min(1).max(999)
});

export type LogoFormInput = z.infer<typeof logoFormSchema>;
