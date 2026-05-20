import { command, getRequestEvent } from '$app/server';
import {
	loadEditablePageContext,
	saveAsInlineSessionOrUpdate
} from '$lib/server/landing-page-inline/context';
import { z } from 'zod';

const allowedFields = ['title', 'intro'] as const;

const inlineEditInputSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	sectionIndex: z.number().int().min(0),
	sectionType: z.literal('keynote_speeches'),
	field: z.enum(allowedFields),
	value: z.string()
});

export const saveKeynoteSpeechesField = command(inlineEditInputSchema, async (input) => {
	const context = await loadEditablePageContext({
		event: getRequestEvent(),
		campaignId: input.campaignId,
		campaignPageId: input.campaignPageId
	});

	const section = context.page.sections[input.sectionIndex];
	if (!section) {
		throw new Error('Section not found');
	}

	if (section.type !== 'keynote_speeches' || input.sectionType !== 'keynote_speeches') {
		throw new Error('Only Keynote Speeches fields can be edited here');
	}

	if (typeof section.props[input.field] !== 'string') {
		throw new Error('Field is not editable');
	}

	const currentValue = section.props[input.field] ?? '';
	if (currentValue === input.value) {
		return {
			saved: false,
			campaignPageId: context.sourcePageRecord.id,
			field: input.field,
			value: currentValue,
			createdSession: false
		};
	}

	const updatedSection = {
		...section,
		props: {
			...section.props,
			[input.field]: input.value
		}
	};

	const updatedPage = {
		...context.page,
		sections: context.page.sections.map((item, index) =>
			index === input.sectionIndex ? updatedSection : item
		)
	};

	const persisted = await saveAsInlineSessionOrUpdate({
		campaignId: input.campaignId,
		sourcePageRecord: context.sourcePageRecord,
		updatedPage
	});

	return {
		saved: true,
		campaignPageId: persisted.campaignPageId,
		field: input.field,
		value: input.value,
		createdSession: persisted.createdSession
	};
});
