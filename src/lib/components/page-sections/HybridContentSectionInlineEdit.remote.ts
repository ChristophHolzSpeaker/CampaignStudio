import { command, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { media_assets } from '$lib/server/db/schema';
import {
	loadEditablePageContext,
	saveAsInlineSessionOrUpdate
} from '$lib/server/landing-page-inline/context';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const inlineEditInputSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	sectionIndex: z.number().int().min(0),
	sectionType: z.literal('hybrid_content_section'),
	target: z.discriminatedUnion('kind', [
		z.object({ kind: z.literal('title') }),
		z.object({ kind: z.literal('intro') }),
		z.object({ kind: z.literal('deepDiveTitle') }),
		z.object({ kind: z.literal('emailCtaTitle') }),
		z.object({ kind: z.literal('benefitTitle'), index: z.number().int().min(0) }),
		z.object({ kind: z.literal('benefitBody'), index: z.number().int().min(0) }),
		z.object({ kind: z.literal('deepDiveItemTitle'), index: z.number().int().min(0) }),
		z.object({ kind: z.literal('deepDiveItemBody'), index: z.number().int().min(0) })
	]),
	value: z.string()
});

const hybridPrimaryVisualImageInputSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	sectionIndex: z.number().int().min(0),
	sectionType: z.literal('hybrid_content_section'),
	assetId: z.string().trim().min(1)
});

const layoutToggleInputSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	sectionIndex: z.number().int().min(0),
	sectionType: z.literal('hybrid_content_section')
});

function hasString(value: unknown): value is string {
	return typeof value === 'string';
}

export const saveHybridContentSectionField = command(inlineEditInputSchema, async (input) => {
	const context = await loadEditablePageContext({
		event: getRequestEvent(),
		campaignId: input.campaignId,
		campaignPageId: input.campaignPageId
	});

	const section = context.page.sections[input.sectionIndex];
	if (!section) {
		throw new Error('Section not found');
	}

	if (section.type !== 'hybrid_content_section' || input.sectionType !== 'hybrid_content_section') {
		throw new Error('Only Hybrid Content section fields can be edited here');
	}

	let currentValue: string;

	switch (input.target.kind) {
		case 'title':
		case 'intro':
		case 'deepDiveTitle':
		case 'emailCtaTitle': {
			const candidate = section.props[input.target.kind];
			if (input.target.kind === 'emailCtaTitle') {
				if (candidate !== undefined && !hasString(candidate)) {
					throw new Error('Field is not editable');
				}
				currentValue = candidate ?? '';
				break;
			}

			if (!hasString(candidate)) {
				throw new Error('Field is not editable');
			}
			currentValue = candidate;
			break;
		}
		case 'benefitTitle':
		case 'benefitBody': {
			const benefit = section.props.benefits[input.target.index];
			if (!benefit) {
				throw new Error('Benefit item not found');
			}
			const key = input.target.kind === 'benefitTitle' ? 'title' : 'body';
			if (!hasString(benefit[key])) {
				throw new Error('Field is not editable');
			}
			currentValue = benefit[key];
			break;
		}
		case 'deepDiveItemTitle':
		case 'deepDiveItemBody': {
			const deepDiveItem = section.props.deepDiveItems[input.target.index];
			if (!deepDiveItem) {
				throw new Error('Deep dive item not found');
			}
			const key = input.target.kind === 'deepDiveItemTitle' ? 'title' : 'body';
			if (!hasString(deepDiveItem[key])) {
				throw new Error('Field is not editable');
			}
			currentValue = deepDiveItem[key];
			break;
		}
	}

	if (currentValue === input.value) {
		return {
			saved: false,
			campaignPageId: context.sourcePageRecord.id,
			target: input.target,
			value: currentValue,
			createdSession: false
		};
	}

	const updatedSection = (() => {
		switch (input.target.kind) {
			case 'title':
			case 'intro':
			case 'deepDiveTitle':
			case 'emailCtaTitle':
				return {
					...section,
					props: {
						...section.props,
						[input.target.kind]: input.value
					}
				};
			case 'benefitTitle':
			case 'benefitBody': {
				const key = input.target.kind === 'benefitTitle' ? 'title' : 'body';
				const targetIndex = input.target.index;
				return {
					...section,
					props: {
						...section.props,
						benefits: section.props.benefits.map((benefit, benefitIndex) => {
							if (benefitIndex !== targetIndex) {
								return benefit;
							}

							return {
								...benefit,
								[key]: input.value
							};
						})
					}
				};
			}
			case 'deepDiveItemTitle':
			case 'deepDiveItemBody': {
				const key = input.target.kind === 'deepDiveItemTitle' ? 'title' : 'body';
				const targetIndex = input.target.index;
				return {
					...section,
					props: {
						...section.props,
						deepDiveItems: section.props.deepDiveItems.map((deepDiveItem, deepDiveIndex) => {
							if (deepDiveIndex !== targetIndex) {
								return deepDiveItem;
							}

							return {
								...deepDiveItem,
								[key]: input.value
							};
						})
					}
				};
			}
		}
	})();

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
		target: input.target,
		value: input.value,
		createdSession: persisted.createdSession
	};
});

export const saveHybridPrimaryVisualImage = command(
	hybridPrimaryVisualImageInputSchema,
	async (input) => {
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
			throw new Error('Only image assets can be used for hybrid primary visuals');
		}

		if (!selectedAsset.sectionTypes.includes('hybrid_content_section')) {
			console.warn(
				`Hybrid primary visual override using non-hybrid-tagged image asset '${selectedAsset.id}'.`
			);
		}

		const nextImageUrl = selectedAsset.primaryUrl.trim();
		const nextImageAlt = (selectedAsset.thumbnailAlt ?? selectedAsset.title).trim();

		if (!nextImageUrl || !nextImageAlt) {
			throw new Error('Selected asset has incomplete image metadata');
		}

		const section = context.page.sections[input.sectionIndex];
		if (!section) {
			throw new Error('Section not found');
		}

		if (
			section.type !== 'hybrid_content_section' ||
			input.sectionType !== 'hybrid_content_section'
		) {
			throw new Error('Only Hybrid Content section images can be edited here');
		}

		const legacyPrimaryVisual = (
			section.props as { supportingVisualItems?: { imageUrl: string; alt: string }[] }
		).supportingVisualItems?.[0];
		const currentImageUrl = (
			section.props.primaryVisual?.imageUrl ??
			legacyPrimaryVisual?.imageUrl ??
			''
		).trim();
		const currentImageAlt = (
			section.props.primaryVisual?.alt ??
			legacyPrimaryVisual?.alt ??
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
				primaryVisual: {
					imageUrl: nextImageUrl,
					alt: nextImageAlt
				}
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
	}
);

export const toggleHybridContentSectionLayout = command(layoutToggleInputSchema, async (input) => {
	const context = await loadEditablePageContext({
		event: getRequestEvent(),
		campaignId: input.campaignId,
		campaignPageId: input.campaignPageId
	});

	const section = context.page.sections[input.sectionIndex];
	if (!section) {
		throw new Error('Section not found');
	}

	if (section.type !== 'hybrid_content_section' || input.sectionType !== 'hybrid_content_section') {
		throw new Error('Only Hybrid Content section layout can be edited here');
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
});
