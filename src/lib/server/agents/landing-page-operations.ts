import { z } from 'zod';

const updateSectionContentOperationSchema = z.object({
	type: z.literal('update_section_content'),
	sectionType: z.string().trim().min(1),
	contentPatch: z.record(z.string(), z.unknown())
});

const updateSectionLayoutOperationSchema = z.object({
	type: z.literal('update_section_layout'),
	sectionType: z.string().trim().min(1),
	layoutPatch: z.record(z.string(), z.unknown())
});

const replaceMediaOperationSchema = z.object({
	type: z.literal('replace_media'),
	sectionType: z.string().trim().min(1),
	field: z.string().trim().min(1),
	value: z.unknown()
});

const reorderSectionOperationSchema = z
	.object({
		type: z.literal('reorder_section'),
		sectionType: z.string().trim().min(1),
		moveBeforeSectionType: z.string().trim().min(1).optional(),
		moveAfterSectionType: z.string().trim().min(1).optional()
	})
	.refine(
		(operation) =>
			Boolean(operation.moveBeforeSectionType) !== Boolean(operation.moveAfterSectionType),
		'Provide exactly one of moveBeforeSectionType or moveAfterSectionType.'
	);

export const landingPageOperationSchema = z.discriminatedUnion('type', [
	updateSectionContentOperationSchema,
	updateSectionLayoutOperationSchema,
	replaceMediaOperationSchema,
	reorderSectionOperationSchema
]);

export const landingPageOperationsEnvelopeSchema = z.object({
	operations: z.array(landingPageOperationSchema)
});

export type LandingPageOperation = z.infer<typeof landingPageOperationSchema>;
