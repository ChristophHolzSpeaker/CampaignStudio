import { command, getRequestEvent } from '$app/server';
import { parseLandingPageDocument } from '$lib/page-builder/page';
import { db } from '$lib/server/db';
import { campaign_pages, campaigns } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { persistGeneratedLandingPage } from '$lib/server/agents/landing-page-pipeline';

const allowedFields = ['headline', 'subheadline', 'eyebrow'] as const;

const inlineEditInputSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	sectionIndex: z.number().int().min(0),
	sectionType: z.literal('immediate_authority_hero'),
	field: z.enum(allowedFields),
	value: z.string()
});

const INLINE_EDIT_SESSION_PREFIX = 'Inline edit session';

type HeroField = (typeof allowedFields)[number];

function canEditField(field: HeroField, value: unknown): boolean {
	if (field === 'eyebrow') {
		return value === undefined || typeof value === 'string';
	}

	return typeof value === 'string';
}

export const saveImmediateAuthorityHeroField = command(inlineEditInputSchema, async (input) => {
	const event = getRequestEvent();
	const {
		data: { user }
	} = await event.locals.supabase.auth.getUser();

	if (!user) {
		throw new Error('Unauthorized');
	}

	const [campaignRecord] = await db
		.select({ id: campaigns.id, status: campaigns.status })
		.from(campaigns)
		.where(eq(campaigns.id, input.campaignId))
		.limit(1);

	if (!campaignRecord) {
		throw new Error('Campaign not found');
	}

	if (campaignRecord.status === 'published') {
		throw new Error('Inline edits are only allowed in preview mode');
	}

	const [sourcePageRecord] = await db
		.select({
			id: campaign_pages.id,
			campaignId: campaign_pages.campaign_id,
			structuredContentJson: campaign_pages.structured_content_json,
			isPublished: campaign_pages.is_published,
			changeNote: campaign_pages.change_note,
			versionNumber: campaign_pages.version_number
		})
		.from(campaign_pages)
		.where(
			and(
				eq(campaign_pages.id, input.campaignPageId),
				eq(campaign_pages.campaign_id, input.campaignId)
			)
		)
		.limit(1);

	if (!sourcePageRecord) {
		throw new Error('Campaign page not found');
	}

	if (sourcePageRecord.isPublished) {
		throw new Error('Published pages cannot be edited inline');
	}

	const page = parseLandingPageDocument(sourcePageRecord.structuredContentJson);
	const section = page.sections[input.sectionIndex];

	if (!section) {
		throw new Error('Section not found');
	}

	if (
		section.type !== 'immediate_authority_hero' ||
		input.sectionType !== 'immediate_authority_hero'
	) {
		throw new Error('Only Immediate Authority Hero fields can be edited here');
	}

	if (!canEditField(input.field, section.props[input.field])) {
		throw new Error('Field is not editable');
	}

	const currentValue = section.props[input.field] ?? '';
	if (currentValue === input.value) {
		return {
			saved: false,
			campaignPageId: sourcePageRecord.id,
			field: input.field,
			value: currentValue,
			createdSession: false
		};
	}

	const updatedPage = {
		...page,
		sections: page.sections.map((item, index) => {
			if (index !== input.sectionIndex || item.type !== 'immediate_authority_hero') {
				return item;
			}

			return {
				...item,
				props: {
					...item.props,
					[input.field]: input.value
				}
			};
		})
	};

	const isExistingSession = (sourcePageRecord.changeNote ?? '').startsWith(
		INLINE_EDIT_SESSION_PREFIX
	);

	if (isExistingSession) {
		await db
			.update(campaign_pages)
			.set({
				structured_content_json: updatedPage,
				updated_at: new Date()
			})
			.where(eq(campaign_pages.id, sourcePageRecord.id));

		return {
			saved: true,
			campaignPageId: sourcePageRecord.id,
			field: input.field,
			value: input.value,
			createdSession: false
		};
	}

	const [latestPage] = await db
		.select({ id: campaign_pages.id })
		.from(campaign_pages)
		.where(eq(campaign_pages.campaign_id, input.campaignId))
		.orderBy(desc(campaign_pages.version_number))
		.limit(1);

	if (!latestPage || latestPage.id !== sourcePageRecord.id) {
		throw new Error('Inline edits are only available on the latest preview version');
	}

	const persisted = await persistGeneratedLandingPage(
		input.campaignId,
		updatedPage,
		undefined,
		`${INLINE_EDIT_SESSION_PREFIX} (v${sourcePageRecord.versionNumber})`
	);

	return {
		saved: true,
		campaignPageId: persisted.campaignPageId,
		field: input.field,
		value: input.value,
		createdSession: true
	};
});
