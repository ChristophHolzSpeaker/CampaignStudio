import { command, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { media_assets } from '$lib/server/db/schema';
import {
	loadEditablePageContext,
	saveAsInlineSessionOrUpdate
} from '$lib/server/landing-page-inline/context';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const allowedFields = ['headline', 'subheadline', 'eyebrow'] as const;

const inlineEditInputSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	sectionIndex: z.number().int().min(0),
	sectionType: z.literal('immediate_authority_hero'),
	field: z.enum(allowedFields),
	value: z.string()
});

type HeroField = (typeof allowedFields)[number];

const heroImageSwapInputSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	sectionIndex: z.number().int().min(0),
	sectionType: z.literal('immediate_authority_hero'),
	assetId: z.string().trim().min(1)
});

const layoutToggleInputSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	sectionIndex: z.number().int().min(0),
	sectionType: z.literal('immediate_authority_hero')
});

function canEditField(field: HeroField, value: unknown): boolean {
	if (field === 'eyebrow') {
		return value === undefined || typeof value === 'string';
	}

	return typeof value === 'string';
}

export const saveImmediateAuthorityHeroField = command(inlineEditInputSchema, async (input) => {
	const context = await loadEditablePageContext({
		event: getRequestEvent(),
		campaignId: input.campaignId,
		campaignPageId: input.campaignPageId
	});

	const section = context.page.sections[input.sectionIndex];
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

export const saveImmediateAuthorityHeroImage = command(heroImageSwapInputSchema, async (input) => {
	const context = await loadEditablePageContext({
		event: getRequestEvent(),
		campaignId: input.campaignId,
		campaignPageId: input.campaignPageId
	});

	const [selectedAsset] = await db
		.select({
			id: media_assets.id,
			kind: media_assets.kind,
			primaryUrl: media_assets.primary_url,
			thumbnailAlt: media_assets.thumbnail_alt,
			title: media_assets.title,
			sectionTypes: media_assets.section_types
		})
		.from(media_assets)
		.where(and(eq(media_assets.id, input.assetId), eq(media_assets.is_active, true)))
		.limit(1);

	if (!selectedAsset) {
		throw new Error('Selected asset not found');
	}

	if (selectedAsset.kind !== 'image') {
		throw new Error('Only image assets can be used for hero images');
	}

	if (!selectedAsset.sectionTypes.includes('immediate_authority_hero')) {
		throw new Error('Selected asset is not approved for immediate authority hero');
	}

	const nextImageUrl = selectedAsset.primaryUrl.trim();
	const nextImageAlt = (selectedAsset.thumbnailAlt ?? selectedAsset.title).trim();

	if (!nextImageUrl) {
		throw new Error('Selected asset has no image URL');
	}

	const section = context.page.sections[input.sectionIndex];
	if (!section) {
		throw new Error('Section not found');
	}

	if (
		section.type !== 'immediate_authority_hero' ||
		input.sectionType !== 'immediate_authority_hero'
	) {
		throw new Error('Only Immediate Authority Hero images can be edited here');
	}

	const currentImageUrl = (
		section.props.heroImageUrl ??
		section.props.videoThumbnailUrl ??
		''
	).trim();
	const currentImageAlt = (
		section.props.heroImageAlt ??
		section.props.videoThumbnailAlt ??
		''
	).trim();

	if (currentImageUrl === nextImageUrl && currentImageAlt === nextImageAlt) {
		return {
			saved: false,
			campaignPageId: context.sourcePageRecord.id,
			imageUrl: currentImageUrl,
			imageAlt: currentImageAlt,
			createdSession: false
		};
	}

	const updatedSection = {
		...section,
		props: {
			...section.props,
			heroImageUrl: nextImageUrl,
			heroImageAlt: nextImageAlt
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
		imageUrl: nextImageUrl,
		imageAlt: nextImageAlt,
		createdSession: persisted.createdSession
	};
});

export const toggleImmediateAuthorityHeroLayout = command(
	layoutToggleInputSchema,
	async (input) => {
		const context = await loadEditablePageContext({
			event: getRequestEvent(),
			campaignId: input.campaignId,
			campaignPageId: input.campaignPageId
		});

		const section = context.page.sections[input.sectionIndex];
		if (!section) {
			throw new Error('Section not found');
		}

		if (
			section.type !== 'immediate_authority_hero' ||
			input.sectionType !== 'immediate_authority_hero'
		) {
			throw new Error('Only Immediate Authority Hero layout can be edited here');
		}

		const nextLayout = section.props.layout === 'left' ? 'right' : 'left';
		const updatedSection = {
			...section,
			props: {
				...section.props,
				layout: nextLayout
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
			layout: nextLayout,
			createdSession: persisted.createdSession
		};
	}
);
